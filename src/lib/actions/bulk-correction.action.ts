"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";

import {
  outcomeAllowedForMatch,
  planCorrection,
  type CandidateMatch,
  type CorrectionPlay,
} from "@/lib/bulk-correction";
import { resolveGradeRequestsForPicks } from "@/lib/grade-request-resolution";
import { outcomeLabel } from "@/lib/grade-requests";
import { settleParlay } from "@/lib/grading";
import { profitUnitsEqual } from "@/lib/grading-correction";
import { prisma } from "@/lib/prisma";
import { loadCorrectionCandidates } from "@/lib/queries/bulk-correction";
import { clvPtsForGrade } from "@/lib/results/closing-snapshot";
import { hasClvColumns } from "@/lib/results/schema-features";
import { lockParlaySettlement } from "@/lib/results/settlement-lock";
import {
  bulkCorrectionSchema,
  type BulkCorrectionInput,
} from "@/lib/schemas/grade-request.schema";
import { requireAdmin } from "@/lib/session";

export type BulkCorrectionResult =
  | {
      ok: true;
      /** Straight plays + parlay legs whose result changed. */
      changedPlays: number;
      straightsChanged: number;
      parlaysResettled: number;
      cappersAffected: number;
      requestsResolved: number;
    }
  | { ok: false; error: string };

const STALE =
  "Some of these plays changed after you opened this page (another grade or correction landed). Nothing was saved — refresh and review again.";

/** Thrown inside the transaction to roll the whole correction back. */
class StaleCorrectionError extends Error {}

/**
 * Apply one result to a pick for one capper or for every capper who logged it.
 *
 * All or nothing: one transaction, and any play whose stored result moved since
 * the admin's preview aborts the lot, so a correction can never land on half of
 * the cappers. Each change writes the same audit rows the single-play tool
 * writes (MANUAL for a first grade, ADMIN_OVERRIDE otherwise, with the admin and
 * the reason), which is also what tells the automatic reconcile pass to leave
 * the result alone. Tickets are re-settled from every leg with `settleParlay`.
 */
export async function applyBulkCorrectionAction(
  input: BulkCorrectionInput,
): Promise<BulkCorrectionResult> {
  const admin = await requireAdmin();
  const parsed = bulkCorrectionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the correction.",
    };
  }
  const { sourcePlayId, outcome, reason, targets } = parsed.data;

  // Re-derive what may be corrected from the database. The browser only ever
  // names plays; it cannot widen the match.
  const candidates = (await loadCorrectionCandidates([sourcePlayId])).get(
    sourcePlayId,
  );
  if (!candidates) return { ok: false, error: "That play was not found." };
  const eligible = new Map<
    string,
    { play: CorrectionPlay; match: CandidateMatch }
  >();
  for (const play of candidates.exact)
    eligible.set(play.id, { play, match: "exact" });
  for (const play of candidates.related) {
    eligible.set(play.id, { play, match: "related" });
  }

  const selected: CorrectionPlay[] = [];
  for (const target of targets) {
    const entry = eligible.get(target.playId);
    if (!entry) {
      return {
        ok: false,
        error:
          "A selected play is not the same pick as this one. Refresh and review again.",
      };
    }
    if (!outcomeAllowedForMatch(outcome, entry.match)) {
      return {
        ok: false,
        error:
          "Only a void can be applied to a pick at a different line or side. Untick those plays or choose Void.",
      };
    }
    if (entry.play.outcome !== target.expectedOutcome) {
      return { ok: false, error: STALE };
    }
    selected.push(entry.play);
  }

  const plan = planCorrection(outcome, selected);
  if (plan.changedPlayCount === 0) {
    return {
      ok: true,
      changedPlays: 0,
      straightsChanged: 0,
      parlaysResettled: 0,
      cappersAffected: 0,
      requestsResolved: 0,
    };
  }

  const playById = new Map(selected.map((play) => [play.id, play]));
  const changedStraights = plan.straights.filter((entry) => entry.changed);
  const changedParlays = plan.parlays.filter((entry) => entry.changed);

  const clvReady = await hasClvColumns();
  const closingById = new Map<string, number | null>();
  if (clvReady && changedStraights.length) {
    const rows = await prisma.play.findMany({
      where: { id: { in: changedStraights.map((entry) => entry.playId) } },
      select: { id: true, closingOddsAmerican: true },
    });
    for (const row of rows) closingById.set(row.id, row.closingOddsAmerican);
  }

  const auditReason = reason.trim();
  try {
    await prisma.$transaction(
      async (tx) => {
        const now = new Date();
        for (const entry of changedStraights) {
          const play = playById.get(entry.playId)!;
          const clvPts = clvReady
            ? clvPtsForGrade(
                play.oddsAmerican,
                closingById.get(play.id) ?? null,
              )
            : null;
          const updated = await tx.play.updateMany({
            where: {
              id: play.id,
              parlayId: null,
              outcome: play.outcome,
              profitUnits: play.profitUnits,
            },
            data: {
              outcome,
              profitUnits: entry.after.profitUnits,
              gradedAt: now,
              ...(clvPts != null ? { clvPts } : {}),
            },
          });
          if (updated.count !== 1) throw new StaleCorrectionError();
          await tx.gradingAudit.create({
            data: {
              playId: play.id,
              previousOutcome: play.outcome,
              newOutcome: outcome,
              previousProfitUnits: play.profitUnits,
              newProfitUnits: entry.after.profitUnits,
              source: play.outcome === "PENDING" ? "MANUAL" : "ADMIN_OVERRIDE",
              gradedById: admin.id,
              reason: auditReason,
            },
          });
        }

        for (const entry of changedParlays) {
          await resettleTicket(tx, {
            parlayId: entry.parlayId,
            snapshot: playById.get(entry.legChanges[0]!.playId)!.parlay!,
            targetedLegIds: new Set(
              selected
                .filter((play) => play.parlay?.id === entry.parlayId)
                .map((play) => play.id),
            ),
            outcome,
            adminId: admin.id,
            reason: auditReason,
            now,
          });
        }
      },
      // Up to a few hundred small writes; the default 5s is too tight.
      { maxWait: 10_000, timeout: 60_000 },
    );
  } catch (error) {
    if (error instanceof StaleCorrectionError)
      return { ok: false, error: STALE };
    console.error("[bulk-correction] transaction failed", error);
    return {
      ok: false,
      error:
        "The correction could not be saved. Nothing was changed — try again.",
    };
  }

  const changedPlayIds = [
    ...changedStraights.map((entry) => entry.playId),
    ...changedParlays.flatMap((entry) =>
      entry.legChanges.map((change) => change.playId),
    ),
  ];
  const requestsResolved = await resolveGradeRequestsForPicks({
    playIds: changedPlayIds,
    parlayIds: changedParlays.map((entry) => entry.parlayId),
    adminId: admin.id,
    note: `${outcomeLabel(outcome)} applied (${plan.changedPlayCount} ${plan.changedPlayCount === 1 ? "play" : "plays"}, ${plan.affectedCapperCount} ${plan.affectedCapperCount === 1 ? "capper" : "cappers"}): ${auditReason}`,
  });

  await revalidateAfterCorrection({
    capperIds: [
      ...new Set([
        ...changedStraights.map((entry) => entry.capperId),
        ...changedParlays.map((entry) => entry.capperId),
      ]),
    ],
    straightIds: changedStraights.map((entry) => entry.playId),
    parlayIds: changedParlays.map((entry) => entry.parlayId),
  });

  return {
    ok: true,
    changedPlays: plan.changedPlayCount,
    straightsChanged: changedStraights.length,
    parlaysResettled: changedParlays.length,
    cappersAffected: plan.affectedCapperCount,
    requestsResolved,
  };
}

/**
 * Change the targeted legs of one ticket and re-settle it from every leg.
 * Locks the ticket first (the auto-grader takes the same lock), then refuses
 * if anything about the ticket moved since the admin's preview.
 */
async function resettleTicket(
  tx: Prisma.TransactionClient,
  input: {
    parlayId: string;
    snapshot: NonNullable<CorrectionPlay["parlay"]>;
    targetedLegIds: Set<string>;
    outcome: Exclude<CorrectionPlay["outcome"], "PENDING">;
    adminId: string;
    reason: string;
    now: Date;
  },
) {
  await lockParlaySettlement(tx, input.parlayId);
  const fresh = await tx.parlay.findUnique({
    where: { id: input.parlayId },
    select: {
      outcome: true,
      profitUnits: true,
      units: true,
      legs: { select: { id: true, outcome: true, oddsAmerican: true } },
    },
  });
  if (!fresh) throw new StaleCorrectionError();
  const freshProfit =
    fresh.profitUnits == null ? null : Number(fresh.profitUnits);
  const snapshotLegs = new Map(
    input.snapshot.legs.map((leg) => [leg.id, leg.outcome]),
  );
  if (
    fresh.outcome !== input.snapshot.outcome ||
    !profitUnitsEqual(freshProfit, input.snapshot.profitUnits) ||
    fresh.legs.length !== input.snapshot.legs.length ||
    fresh.legs.some((leg) => snapshotLegs.get(leg.id) !== leg.outcome)
  ) {
    throw new StaleCorrectionError();
  }

  const settlement = settleParlay(
    fresh.legs.map((leg) => ({
      outcome: input.targetedLegIds.has(leg.id) ? input.outcome : leg.outcome,
      oddsAmerican: leg.oddsAmerican,
    })),
    Number(fresh.units),
  );

  for (const leg of fresh.legs) {
    if (!input.targetedLegIds.has(leg.id) || leg.outcome === input.outcome) {
      continue;
    }
    const updated = await tx.play.updateMany({
      where: { id: leg.id, parlayId: input.parlayId, outcome: leg.outcome },
      data: { outcome: input.outcome, gradedAt: input.now },
    });
    if (updated.count !== 1) throw new StaleCorrectionError();
    await tx.gradingAudit.create({
      data: {
        playId: leg.id,
        previousOutcome: leg.outcome,
        newOutcome: input.outcome,
        source: leg.outcome === "PENDING" ? "MANUAL" : "ADMIN_OVERRIDE",
        gradedById: input.adminId,
        reason: input.reason,
      },
    });
  }

  await tx.parlay.update({
    where: { id: input.parlayId },
    data: {
      outcome: settlement.outcome,
      profitUnits: settlement.profitUnits,
      combinedOddsAmerican: settlement.effectiveOddsAmerican,
      gradedAt: settlement.outcome === "PENDING" ? null : input.now,
    },
  });
  // Always recorded when a leg changed — even if the ticket's result did not —
  // so the reconcile pass sees a human settlement and leaves the ticket alone.
  await tx.parlayGradingAudit.create({
    data: {
      parlayId: input.parlayId,
      previousOutcome: fresh.outcome,
      newOutcome: settlement.outcome,
      previousProfitUnits: freshProfit,
      newProfitUnits: settlement.profitUnits,
      source: fresh.outcome === "PENDING" ? "MANUAL" : "ADMIN_OVERRIDE",
      gradedById: input.adminId,
      reason: input.reason,
    },
  });
}

async function revalidateAfterCorrection(input: {
  capperIds: string[];
  straightIds: string[];
  parlayIds: string[];
}) {
  // Leaderboard, profile and Discover reads are cached under this tag; expire
  // it so every capper's record reflects the correction on the next view.
  revalidateTag("leaderboard", { expire: 0 });
  for (const path of [
    "/dashboard",
    "/dashboard/picks",
    "/admin/grading",
    "/admin/grading/requests",
    "/admin/plays",
    "/picks",
    "/leaderboard",
    "/discover",
    "/",
  ]) {
    revalidatePath(path);
  }
  for (const id of input.straightIds)
    revalidatePath(`/admin/plays/straight/${id}`);
  for (const id of input.parlayIds) revalidatePath(`/admin/plays/parlay/${id}`);
  if (input.capperIds.length === 0) return;
  try {
    const cappers = await prisma.capperProfile.findMany({
      where: { id: { in: input.capperIds } },
      select: { user: { select: { username: true } } },
    });
    for (const capper of cappers) {
      const username = capper.user.username?.replace(/^@/, "");
      if (username) revalidatePath(`/cappers/${username}`);
    }
  } catch (error) {
    console.error(
      "[bulk-correction] profile revalidation lookup failed",
      error,
    );
  }
}
