"use server";

import { revalidatePath } from "next/cache";

import { profitUnitsForOutcome } from "@/lib/odds";
import { prisma } from "@/lib/prisma";
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
  const { playId, outcome, reason } = parsed.data;

  const play = await prisma.play.findUnique({
    where: { id: playId },
    select: {
      id: true,
      outcome: true,
      oddsAmerican: true,
      units: true,
      parlayId: true,
    },
  });
  if (!play) return { ok: false, error: "Play not found." };
  if (play.parlayId) {
    return {
      ok: false,
      error: "This play is a parlay leg — grade it through the parlay.",
    };
  }
  if (play.outcome === outcome) return { ok: true };
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

  await prisma.$transaction([
    prisma.play.update({
      where: { id: play.id },
      data: { outcome, profitUnits, gradedAt: new Date() },
    }),
    prisma.gradingAudit.create({
      data: {
        playId: play.id,
        previousOutcome: play.outcome,
        newOutcome: outcome,
        source,
        gradedById: admin.id,
        reason,
      },
    }),
  ]);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/picks");
  revalidatePath("/admin/grading");
  return { ok: true };
}
