import "server-only";

import type { Outcome, Prisma } from "@prisma/client";

import { settleParlay } from "@/lib/grading";
import { profitUnitsForOutcome } from "@/lib/odds";
import { prisma } from "@/lib/prisma";
import { resolveOutcome } from "@/lib/results/match";
import type { ResultsProvider } from "@/lib/results/provider";

export type AutoGradeResult = {
  graded: number;
  skipped: number;
  provider: string;
};

/**
 * Grade every confidently-resolvable pending position from settled results.
 * Unmatched plays/parlays stay PENDING (admin fallback). Writes append-only AUTO
 * audits for every graded straight play or parlay leg and derives P/L from odds.
 */
export async function autoGradePending(
  provider: ResultsProvider,
): Promise<AutoGradeResult> {
  const [pending, pendingParlays] = await Promise.all([
    prisma.play.findMany({
      where: { outcome: "PENDING", parlayId: null },
      select: {
        id: true,
        sport: true,
        market: true,
        selection: true,
        oddsAmerican: true,
        units: true,
      },
      take: 500,
    }),
    prisma.parlay.findMany({
      where: { outcome: "PENDING" },
      select: {
        id: true,
        units: true,
        legs: {
          select: {
            id: true,
            sport: true,
            market: true,
            selection: true,
            oddsAmerican: true,
            units: true,
            outcome: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
      take: 250,
    }),
  ]);

  const pendingStraight = pending.map((p) => ({
    ...p,
    units: Number(p.units),
  }));

  if (pendingStraight.length === 0 && pendingParlays.length === 0) {
    return { graded: 0, skipped: 0, provider: provider.name };
  }

  const games = await provider.fetchSettled();
  let graded = 0;
  let skipped = 0;

  for (const play of pendingStraight) {
    const outcome = resolveOutcome(play, games);
    if (!outcome) {
      skipped++;
      continue;
    }
    const profitUnits = profitUnitsForOutcome(
      outcome,
      play.oddsAmerican,
      play.units,
    );
    await prisma.$transaction([
      prisma.play.update({
        where: { id: play.id },
        data: { outcome, profitUnits, gradedAt: new Date() },
      }),
      prisma.gradingAudit.create({
        data: {
          playId: play.id,
          previousOutcome: "PENDING",
          newOutcome: outcome,
          source: "AUTO",
          gradedById: null,
          reason: `Auto-graded from ${provider.name} settled results`,
        },
      }),
    ]);
    graded++;
  }

  for (const parlay of pendingParlays) {
    const resolvedLegs = parlay.legs.map((leg) => {
      if (leg.outcome !== "PENDING") {
        return { ...leg, newOutcome: leg.outcome };
      }
      const outcome = resolveOutcome(
        {
          id: leg.id,
          sport: leg.sport,
          market: leg.market,
          selection: leg.selection,
          oddsAmerican: leg.oddsAmerican,
          units: Number(leg.units),
        },
        games,
      );
      return { ...leg, newOutcome: (outcome ?? "PENDING") as Outcome };
    });

    const settlement = settleParlay(
      resolvedLegs.map((leg) => ({
        outcome: leg.newOutcome,
        oddsAmerican: leg.oddsAmerican,
      })),
      Number(parlay.units),
    );

    if (settlement.outcome === "PENDING") {
      skipped++;
      continue;
    }

    const ops: Prisma.PrismaPromise<unknown>[] = resolvedLegs.flatMap((leg) => {
      if (leg.newOutcome === leg.outcome) return [];
      return [
        prisma.play.update({
          where: { id: leg.id },
          data: { outcome: leg.newOutcome, gradedAt: new Date() },
        }),
        prisma.gradingAudit.create({
          data: {
            playId: leg.id,
            previousOutcome: leg.outcome,
            newOutcome: leg.newOutcome,
            source: "AUTO",
            gradedById: null,
            reason: `Auto-graded parlay leg from ${provider.name} settled results`,
          },
        }),
      ];
    });

    ops.push(
      prisma.parlay.update({
        where: { id: parlay.id },
        data: {
          outcome: settlement.outcome,
          profitUnits: settlement.profitUnits,
          gradedAt: new Date(),
        },
      }),
    );

    await prisma.$transaction(ops);
    graded++;
  }

  return { graded, skipped, provider: provider.name };
}
