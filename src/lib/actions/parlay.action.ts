"use server";

import { revalidatePath } from "next/cache";

import { settleParlay } from "@/lib/grading";
import { profitUnitsEqual } from "@/lib/grading-correction";
import { isBookKey } from "@/lib/books";
import { fetchLiveLine, verifyPick } from "@/lib/odds-api";
import { decidePickIntegrity, marketKeysForMarket } from "@/lib/odds-verify";
import {
  americanToDecimal,
  combineDecimalOdds,
  decimalToAmerican,
} from "@/lib/odds";
import { moveKey, resolveCaptureOdds } from "@/lib/odds-movement";
import type { AcceptedMove, MovedLinePayload } from "@/lib/odds-movement";
import { resolvePackageAttribution } from "@/lib/package-attribution";
import { prisma } from "@/lib/prisma";
import {
  createParlaySchema,
  gradeParlaySchema,
  type CreateParlayInput,
  type GradeParlayInput,
} from "@/lib/schemas/parlay.schema";
import { getCurrentAccount, requireAdmin } from "@/lib/session";
import { isVerifiedTier, type ParlayReceipt } from "@/lib/verification";

type Result = { ok: true } | { ok: false; error: string };
export type CreateParlayResult =
  | { ok: true; receipt: ParlayReceipt }
  | { ok: false; error: string }
  | { ok: false; needsConfirm: MovedLinePayload[] }
  | { ok: false; unavailable: MovedLinePayload[] };

/** Capper logs a multi-leg parlay. Stake lives on the parlay; legs are components. */
export async function createParlay(
  input: CreateParlayInput,
  acceptedMoves?: AcceptedMove[],
): Promise<CreateParlayResult> {
  const account = await getCurrentAccount();
  if (!account) return { ok: false, error: "You must be logged in." };
  if (account.accountStatus !== "ACTIVE") {
    return { ok: false, error: "Your account is not active." };
  }
  if (!account.emailVerified) {
    return { ok: false, error: "Verify your email before submitting plays." };
  }
  if (!account.legalAcceptance) {
    return {
      ok: false,
      error: "Accept the current terms before submitting plays.",
    };
  }

  const parsed = createParlaySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ??
        "Please check the form and try again.",
    };
  }

  const profile = await prisma.capperProfile.findUnique({
    where: { userId: account.id },
    select: { id: true, books: true },
  });
  if (!profile) return { ok: false, error: "No capper profile found." };

  const d = parsed.data;
  const packageIds = await resolvePackageAttribution(profile.id, d.packageIds);
  if (!packageIds) {
    return {
      ok: false,
      error: "One or more selected packages are unavailable.",
    };
  }
  const now = new Date();

  // Verification is the universal standard: every leg must be board-bound; each is
  // odds-guarded (M5) then C1/C3-checked. Any unavailable/changed leg without a matching
  // acceptedMoves entry blocks the whole parlay — no partial write.
  const needsConfirm: MovedLinePayload[] = [];
  const unavailable: MovedLinePayload[] = [];
  const decided: Array<{
    leg: (typeof d.legs)[number];
    eventStartsAt: Date;
    oddsAmerican: number;
    selectedOddsAmerican: number;
    oddsMovedAccepted: boolean;
    moveNote?: string;
    loggedPreGame: boolean;
    oddsVerified: boolean;
    tier: "AUTO_VERIFIED" | "VERIFIED" | "SELF_REPORTED";
  }> = [];

  for (const [i, l] of d.legs.entries()) {
    if (!l.eventId || !l.eventStartsAt || !l.side) {
      return {
        ok: false,
        error: `Leg ${i + 1}: pick a line from the board — free-text legs aren't accepted.`,
      };
    }
    const eventStartsAt = new Date(l.eventStartsAt);
    // No live betting — every leg must be pre-game. A started leg rejects the parlay.
    if (eventStartsAt.getTime() <= Date.now()) {
      return {
        ok: false,
        error: `Leg ${i + 1}: this event has already started. SCL only accepts pre-game picks — no live betting.`,
      };
    }
    const marketKeys = marketKeysForMarket(l.market);
    const key = moveKey({
      eventId: l.eventId,
      market: l.market,
      side: l.side,
      line: l.line,
      player: l.player,
    });
    const captureBook = l.book && isBookKey(l.book) ? l.book : null;

    const { event: liveEvent, liveAmerican } = await fetchLiveLine({
      sclSport: l.sport,
      eventId: l.eventId,
      marketKeys,
      side: l.side,
      line: l.line,
      player: l.player,
      book: captureBook,
      books: profile.books,
    });
    if (!liveEvent) {
      return {
        ok: false,
        error: `Leg ${i + 1}: odds unavailable for this event — try again.`,
      };
    }

    const capture = resolveCaptureOdds({
      selectedAmerican: l.oddsAmerican,
      liveAmerican,
      acceptedMoves,
      moveKey: key,
      eventId: l.eventId,
      eventLabel: l.eventLabel ?? l.selection,
      market: l.market,
      selection: l.selection,
      side: l.side,
      sport: l.sport,
      line: l.line,
      player: l.player,
      book: captureBook,
      verifiedAt: now,
    });

    if (capture.status === "unavailable") {
      unavailable.push(capture.moved);
      continue;
    }
    if (capture.status === "needs_confirm") {
      needsConfirm.push(capture.moved);
      continue;
    }

    const verify = await verifyPick({
      sclSport: l.sport,
      eventId: l.eventId,
      marketKeys,
      side: l.side,
      line: l.line,
      player: l.player,
      claimedAmerican: capture.oddsAmerican,
      books: profile.books,
    });
    const decision = decidePickIntegrity({
      now,
      eventStartsAt,
      eventBound: true,
      verify,
      source: "MANUAL",
    });
    if (!decision.accept) {
      return { ok: false, error: `Leg ${i + 1}: ${decision.reason}` };
    }
    decided.push({
      leg: l,
      eventStartsAt,
      oddsAmerican: capture.oddsAmerican,
      selectedOddsAmerican: capture.selectedOddsAmerican,
      oddsMovedAccepted: capture.oddsMovedAccepted,
      moveNote: capture.moveNote,
      loggedPreGame: decision.loggedPreGame,
      oddsVerified: decision.oddsVerified,
      tier: decision.tier,
    });
  }

  if (unavailable.length) {
    return { ok: false, unavailable };
  }
  if (needsConfirm.length) {
    return { ok: false, needsConfirm };
  }

  const combinedDecimal = combineDecimalOdds(
    decided.map((x) => americanToDecimal(x.oddsAmerican)),
  );
  const combinedOddsAmerican = decimalToAmerican(combinedDecimal);
  const tiers = decided.map((x) => x.tier);
  const verifiedLegCount = tiers.filter(isVerifiedTier).length;
  const allLoggedPreGame = decided.every((x) => x.loggedPreGame);
  const moveNotes = decided.map((x) => x.moveNote).filter(Boolean) as string[];
  const legBooks = [
    ...new Set(
      decided
        .map((x) => (x.leg.book && isBookKey(x.leg.book) ? x.leg.book : null))
        .filter((b): b is NonNullable<typeof b> => b != null),
    ),
  ];
  const parlayBook = legBooks.length === 1 ? legBooks[0]! : null;

  const parlay = await prisma.parlay.create({
    data: {
      capperId: profile.id,
      units: d.units,
      combinedOddsAmerican,
      packageLinks: {
        create: packageIds.map((packageId) => ({ packageId })),
      },
      legs: {
        create: decided.map(
          ({
            leg: l,
            eventStartsAt,
            oddsAmerican,
            selectedOddsAmerican,
            oddsMovedAccepted,
            ...v
          }) => ({
            capperId: profile.id,
            sport: l.sport,
            league: l.league ?? null,
            market: l.market,
            selection: l.selection,
            oddsAmerican,
            selectedOddsAmerican,
            oddsMovedAccepted,
            units: 0, // the parlay carries the stake; legs are components
            eventId: l.eventId,
            eventLabel: l.eventLabel ?? null,
            eventStartsAt,
            side: l.side,
            line: l.line ?? null,
            book: l.book && isBookKey(l.book) ? l.book : null,
            source: "MANUAL",
            loggedPreGame: v.loggedPreGame,
            oddsVerified: v.oddsVerified,
            verificationTier: v.tier,
          }),
        ),
      },
    },
    select: { createdAt: true },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/picks");
  return {
    ok: true,
    receipt: {
      kind: "parlay",
      legCount: decided.length,
      combinedOddsAmerican,
      capturedAt: parlay.createdAt.toISOString(),
      allLoggedPreGame,
      verifiedLegCount,
      tiers,
      units: d.units,
      toWinUnits: d.units * (combinedDecimal - 1),
      moveNotes: moveNotes.length ? moveNotes : undefined,
      book: parlayBook,
    },
  };
}

/**
 * Admin grades a parlay by assigning each leg's outcome; the parlay is settled from
 * the legs (any loss loses it; push/void legs drop and odds recombine). P/L lands on
 * the parlay row; each changed leg gets an append-only audit entry.
 */
export async function gradeParlayAction(
  input: GradeParlayInput,
): Promise<Result> {
  const admin = await requireAdmin();

  const parsed = gradeParlaySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the grade.",
    };
  }
  const {
    parlayId,
    legs: legGrades,
    reason,
    expectedOutcome,
    expectedProfitUnits,
  } = parsed.data;
  if (!reason) {
    return { ok: false, error: "A reason is required to grade a parlay." };
  }
  const auditReason = reason.trim();

  const parlay = await prisma.parlay.findUnique({
    where: { id: parlayId },
    select: {
      id: true,
      units: true,
      outcome: true,
      profitUnits: true,
      capper: {
        select: {
          user: {
            select: { username: true },
          },
        },
      },
      legs: {
        select: {
          id: true,
          oddsAmerican: true,
          outcome: true,
        },
      },
    },
  });
  if (!parlay) return { ok: false, error: "Parlay not found." };

  const currentProfitUnits =
    parlay.profitUnits == null ? null : Number(parlay.profitUnits);
  if (
    (expectedOutcome !== undefined && parlay.outcome !== expectedOutcome) ||
    (expectedProfitUnits !== undefined &&
      !profitUnitsEqual(currentProfitUnits, expectedProfitUnits))
  ) {
    return {
      ok: false,
      error:
        "This parlay settlement changed after you opened it. Refresh and review again.",
    };
  }

  const legById = new Map(parlay.legs.map((l) => [l.id, l]));
  for (const g of legGrades) {
    const leg = legById.get(g.playId);
    if (!leg) {
      return {
        ok: false,
        error: "A submitted leg does not belong to this parlay.",
      };
    }
    if (g.expectedOutcome !== undefined && g.expectedOutcome !== leg.outcome) {
      return {
        ok: false,
        error:
          "A parlay leg changed after you opened it. Refresh and review again.",
      };
    }
  }
  const gradeById = new Map(legGrades.map((g) => [g.playId, g.outcome]));

  const settledLegs = parlay.legs.map((leg) => ({
    ...leg,
    newOutcome: gradeById.get(leg.id) ?? leg.outcome,
  }));

  const settlement = settleParlay(
    settledLegs.map((l) => ({
      outcome: l.newOutcome,
      oddsAmerican: l.oddsAmerican,
    })),
    Number(parlay.units),
  );

  const changedLegs = settledLegs.filter(
    (leg) => leg.newOutcome !== leg.outcome,
  );
  const parentChanged =
    settlement.outcome !== parlay.outcome ||
    !profitUnitsEqual(settlement.profitUnits, currentProfitUnits);
  if (!changedLegs.length && !parentChanged) return { ok: true };

  const source = parlay.outcome === "PENDING" ? "MANUAL" : "ADMIN_OVERRIDE";
  const applied = await prisma.$transaction(async (tx) => {
    const fresh = await tx.parlay.findUnique({
      where: { id: parlay.id },
      select: {
        outcome: true,
        profitUnits: true,
        legs: {
          select: { id: true, outcome: true },
        },
      },
    });
    const freshProfitUnits =
      fresh?.profitUnits == null ? null : Number(fresh.profitUnits);
    const freshLegById = new Map(
      fresh?.legs.map((leg) => [leg.id, leg.outcome]) ?? [],
    );
    const legsAreFresh =
      fresh?.legs.length === parlay.legs.length &&
      parlay.legs.every((leg) => freshLegById.get(leg.id) === leg.outcome);
    if (
      !fresh ||
      fresh.outcome !== parlay.outcome ||
      !profitUnitsEqual(freshProfitUnits, currentProfitUnits) ||
      !legsAreFresh
    ) {
      return false;
    }

    for (const leg of changedLegs) {
      await tx.play.update({
        where: { id: leg.id },
        data: { outcome: leg.newOutcome, gradedAt: new Date() },
      });
      await tx.gradingAudit.create({
        data: {
          playId: leg.id,
          previousOutcome: leg.outcome,
          newOutcome: leg.newOutcome,
          source: leg.outcome === "PENDING" ? "MANUAL" : "ADMIN_OVERRIDE",
          gradedById: admin.id,
          reason: auditReason,
        },
      });
    }
    await tx.parlay.update({
      where: { id: parlay.id },
      data: {
        outcome: settlement.outcome,
        profitUnits: settlement.profitUnits,
        gradedAt: settlement.outcome === "PENDING" ? null : new Date(),
      },
    });
    await tx.parlayGradingAudit.create({
      data: {
        parlayId: parlay.id,
        previousOutcome: parlay.outcome,
        newOutcome: settlement.outcome,
        previousProfitUnits: currentProfitUnits,
        newProfitUnits: settlement.profitUnits,
        source,
        gradedById: admin.id,
        reason: auditReason,
      },
    });
    return true;
  });

  if (!applied) {
    return {
      ok: false,
      error:
        "This parlay changed while you were saving. Refresh and review again.",
    };
  }

  revalidatePath("/admin/grading");
  revalidatePath("/admin/plays");
  revalidatePath(`/admin/plays/parlay/${parlay.id}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/picks");
  revalidatePath("/picks");
  revalidatePath("/leaderboard");
  revalidatePath("/discover");
  revalidatePath("/");
  const username = parlay.capper.user.username?.replace(/^@/, "");
  if (username) revalidatePath(`/cappers/${username}`);
  return { ok: true };
}
