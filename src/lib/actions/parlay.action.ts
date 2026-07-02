"use server";

import { revalidatePath } from "next/cache";

import { settleParlay } from "@/lib/grading";
import {
  americanToDecimal,
  combineDecimalOdds,
  decimalToAmerican,
} from "@/lib/odds";
import { prisma } from "@/lib/prisma";
import {
  createParlaySchema,
  gradeParlaySchema,
  type CreateParlayInput,
  type GradeParlayInput,
} from "@/lib/schemas/parlay.schema";
import { getCurrentAccount, requireAdmin } from "@/lib/session";

type Result = { ok: true } | { ok: false; error: string };

/** Capper logs a multi-leg parlay. Stake lives on the parlay; legs are components. */
export async function createParlay(input: CreateParlayInput): Promise<Result> {
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
    select: { id: true },
  });
  if (!profile) return { ok: false, error: "No capper profile found." };

  const d = parsed.data;
  const combinedDecimal = combineDecimalOdds(
    d.legs.map((l) => americanToDecimal(l.oddsAmerican)),
  );

  await prisma.parlay.create({
    data: {
      capperId: profile.id,
      units: d.units,
      combinedOddsAmerican: decimalToAmerican(combinedDecimal),
      legs: {
        create: d.legs.map((l) => ({
          capperId: profile.id,
          sport: l.sport,
          league: l.league ?? null,
          market: l.market,
          selection: l.selection,
          oddsAmerican: l.oddsAmerican,
          units: 0, // the parlay carries the stake; legs are components
        })),
      },
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/picks");
  return { ok: true };
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
  const { parlayId, legs: legGrades, reason } = parsed.data;
  if (!reason) {
    return { ok: false, error: "A reason is required to grade a parlay." };
  }

  const parlay = await prisma.parlay.findUnique({
    where: { id: parlayId },
    select: {
      id: true,
      units: true,
      legs: { select: { id: true, oddsAmerican: true, outcome: true } },
    },
  });
  if (!parlay) return { ok: false, error: "Parlay not found." };

  const legById = new Map(parlay.legs.map((l) => [l.id, l]));
  for (const g of legGrades) {
    if (!legById.has(g.playId)) {
      return {
        ok: false,
        error: "A submitted leg does not belong to this parlay.",
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

  const ops = [];
  for (const leg of settledLegs) {
    if (leg.newOutcome === leg.outcome) continue;
    ops.push(
      prisma.play.update({
        where: { id: leg.id },
        data: { outcome: leg.newOutcome, gradedAt: new Date() },
      }),
      prisma.gradingAudit.create({
        data: {
          playId: leg.id,
          previousOutcome: leg.outcome,
          newOutcome: leg.newOutcome,
          source: leg.outcome === "PENDING" ? "MANUAL" : "ADMIN_OVERRIDE",
          gradedById: admin.id,
          reason,
        },
      }),
    );
  }
  ops.push(
    prisma.parlay.update({
      where: { id: parlay.id },
      data: {
        outcome: settlement.outcome,
        profitUnits: settlement.profitUnits,
        gradedAt: settlement.outcome === "PENDING" ? null : new Date(),
      },
    }),
  );

  await prisma.$transaction(ops);

  revalidatePath("/admin/grading");
  revalidatePath("/dashboard");
  return { ok: true };
}
