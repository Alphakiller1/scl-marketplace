"use server";

import { revalidatePath } from "next/cache";

import { profitUnitsEqual } from "@/lib/grading-correction";
import { profitUnitsForOutcome } from "@/lib/odds";
import { prisma } from "@/lib/prisma";
import { ensureClosingAndClv } from "@/lib/results/closing-snapshot";
import { hasClvColumns } from "@/lib/results/schema-features";
import {
  gradePlaySchema,
  type GradePlayInput,
} from "@/lib/schemas/grading.schema";
import { requireAdmin } from "@/lib/session";

type GradeResult = { ok: true } | { ok: false; error: string };

/**
 * Admin grades a straight play (manual grade, or override of an existing grade).
 * Profit is derived from the play's odds + units; every change is written to the
 * append-only GradingAudit with a required reason. Parlay legs are graded via the
 * parlay flow, not here, so leg P/L never double-counts against the parent.
 * CLV uses the captured close or makes one last capture attempt before grading.
 */
export async function gradePlayAction(
  input: GradePlayInput,
): Promise<GradeResult> {
  const admin = await requireAdmin();

  const parsed = gradePlaySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the grade.",
    };
  }
  const { playId, outcome, reason, expectedOutcome, expectedProfitUnits } =
    parsed.data;

  const clvReady = await hasClvColumns();
  const play = await prisma.play.findUnique({
    where: { id: playId },
    select: {
      id: true,
      outcome: true,
      profitUnits: true,
      oddsAmerican: true,
      units: true,
      parlayId: true,
      sport: true,
      eventId: true,
      book: true,
      market: true,
      side: true,
      line: true,
      league: true,
      capper: {
        select: {
          user: {
            select: { username: true },
          },
        },
      },
      ...(clvReady ? { closingOddsAmerican: true } : {}),
    },
  });
  if (!play) return { ok: false, error: "Play not found." };
  if (play.parlayId) {
    return {
      ok: false,
      error: "This play is a parlay leg — grade it through the parlay.",
    };
  }
  const currentProfitUnits =
    play.profitUnits == null ? null : Number(play.profitUnits);
  if (
    (expectedOutcome !== undefined && play.outcome !== expectedOutcome) ||
    (expectedProfitUnits !== undefined &&
      !profitUnitsEqual(currentProfitUnits, expectedProfitUnits))
  ) {
    return {
      ok: false,
      error:
        "This settlement changed after you opened it. Refresh and review again.",
    };
  }
  if (!reason) {
    return {
      ok: false,
      error: "A reason is required to grade or override a play.",
    };
  }

  // First grade of a pending play is MANUAL; changing a settled outcome is an ADMIN_OVERRIDE.
  const source = play.outcome === "PENDING" ? "MANUAL" : "ADMIN_OVERRIDE";
  const profitUnits = profitUnitsForOutcome(
    outcome,
    play.oddsAmerican,
    Number(play.units),
  );
  if (
    play.outcome === outcome &&
    profitUnitsEqual(currentProfitUnits, profitUnits)
  ) {
    return { ok: true };
  }

  const existingClose =
    "closingOddsAmerican" in play
      ? ((play as { closingOddsAmerican?: number | null })
          .closingOddsAmerican ?? null)
      : null;

  const clv = clvReady
    ? await ensureClosingAndClv({
        id: play.id,
        sport: play.sport,
        eventId: play.eventId,
        book: play.book,
        market: play.market,
        side: play.side,
        line: play.line,
        league: play.league,
        oddsAmerican: play.oddsAmerican,
        closingOddsAmerican: existingClose,
      })
    : { closingOddsAmerican: null, clvPts: null };

  const applied = await prisma.$transaction(async (tx) => {
    const fresh = await tx.play.findUnique({
      where: { id: play.id },
      select: { outcome: true, profitUnits: true },
    });
    const freshProfitUnits =
      fresh?.profitUnits == null ? null : Number(fresh.profitUnits);
    if (
      !fresh ||
      fresh.outcome !== play.outcome ||
      !profitUnitsEqual(freshProfitUnits, currentProfitUnits)
    ) {
      return false;
    }

    await tx.play.update({
      where: { id: play.id },
      data: {
        outcome,
        profitUnits,
        gradedAt: new Date(),
        ...(clv.clvPts != null ? { clvPts: clv.clvPts } : {}),
        ...(clv.closingOddsAmerican != null && existingClose == null
          ? {
              closingOddsAmerican: clv.closingOddsAmerican,
              closingCapturedAt: new Date(),
            }
          : {}),
      },
      select: { id: true },
    });
    await tx.gradingAudit.create({
      data: {
        playId: play.id,
        previousOutcome: play.outcome,
        newOutcome: outcome,
        previousProfitUnits: currentProfitUnits,
        newProfitUnits: profitUnits,
        source,
        gradedById: admin.id,
        reason,
      },
    });
    return true;
  });

  if (!applied) {
    return {
      ok: false,
      error:
        "This settlement changed while you were saving. Refresh and review again.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/picks");
  revalidatePath("/admin/grading");
  revalidatePath("/admin/plays");
  revalidatePath(`/admin/plays/straight/${play.id}`);
  revalidatePath("/picks");
  revalidatePath("/leaderboard");
  revalidatePath("/discover");
  revalidatePath("/");
  const username = play.capper.user.username?.replace(/^@/, "");
  if (username) revalidatePath(`/cappers/${username}`);
  return { ok: true };
}
