import "server-only";

import { settleParlay } from "@/lib/grading";
import { profitUnitsForOutcome } from "@/lib/odds";
import { prisma } from "@/lib/prisma";
import { clvPtsForGrade } from "@/lib/results/closing-snapshot";
import { isDeferredProp, resolveOutcome } from "@/lib/results/match";
import type { ResultsProvider } from "@/lib/results/provider";

export type AutoGradeResult = {
  graded: number;
  skipped: number;
  parlaysGraded: number;
  clvSnapshots?: number;
  provider: string;
};

async function gradeStraightPlays(
  provider: ResultsProvider,
  now: Date,
): Promise<{ graded: number; skipped: number }> {
  const pending = (
    await prisma.play.findMany({
      where: { outcome: "PENDING", parlayId: null },
      select: {
        id: true,
        sport: true,
        market: true,
        selection: true,
        oddsAmerican: true,
        units: true,
        eventId: true,
        eventStartsAt: true,
        side: true,
        line: true,
        closingOddsAmerican: true,
      },
      take: 500,
    })
  )
    .map((p) => ({
      ...p,
      units: Number(p.units),
      line: p.line == null ? null : Number(p.line),
    }))
    .filter(
      (p) =>
        p.eventStartsAt == null || p.eventStartsAt.getTime() <= now.getTime(),
    );

  if (pending.length === 0) return { graded: 0, skipped: 0 };

  const sports = [...new Set(pending.map((p) => p.sport))];
  const games = await provider.fetchSettledForSports(sports);
  let graded = 0;
  let skipped = 0;

  for (const play of pending) {
    if (isDeferredProp(play)) {
      console.info(`[auto-grade] play ${play.id} skipped: props_deferred`);
      skipped++;
      continue;
    }
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
    const clvPts = clvPtsForGrade(play.oddsAmerican, play.closingOddsAmerican);
    await prisma.$transaction([
      prisma.play.update({
        where: { id: play.id },
        data: {
          outcome,
          profitUnits,
          gradedAt: new Date(),
          ...(clvPts != null ? { clvPts } : {}),
        },
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

  return { graded, skipped };
}

async function gradeParlayLegs(
  provider: ResultsProvider,
  now: Date,
): Promise<{ graded: number; skipped: number }> {
  const pending = (
    await prisma.play.findMany({
      where: { outcome: "PENDING", parlayId: { not: null } },
      select: {
        id: true,
        sport: true,
        market: true,
        selection: true,
        oddsAmerican: true,
        units: true,
        eventId: true,
        eventStartsAt: true,
        side: true,
        line: true,
        closingOddsAmerican: true,
      },
      take: 500,
    })
  )
    .map((p) => ({
      ...p,
      units: Number(p.units),
      line: p.line == null ? null : Number(p.line),
    }))
    .filter(
      (p) =>
        p.eventStartsAt == null || p.eventStartsAt.getTime() <= now.getTime(),
    );

  if (pending.length === 0) return { graded: 0, skipped: 0 };

  const sports = [...new Set(pending.map((p) => p.sport))];
  const games = await provider.fetchSettledForSports(sports);
  let graded = 0;
  let skipped = 0;

  for (const play of pending) {
    if (isDeferredProp(play)) {
      console.info(
        `[auto-grade] parlay leg ${play.id} skipped: props_deferred`,
      );
      skipped++;
      continue;
    }
    const outcome = resolveOutcome(play, games);
    if (!outcome) {
      skipped++;
      continue;
    }
    await prisma.$transaction([
      prisma.play.update({
        where: { id: play.id },
        data: {
          outcome,
          profitUnits: 0,
          gradedAt: new Date(),
        },
      }),
      prisma.gradingAudit.create({
        data: {
          playId: play.id,
          previousOutcome: "PENDING",
          newOutcome: outcome,
          source: "AUTO",
          gradedById: null,
          reason: `Auto-graded parlay leg from ${provider.name} settled results`,
        },
      }),
    ]);
    graded++;
  }

  return { graded, skipped };
}

async function gradePendingParlays(): Promise<number> {
  const parlays = await prisma.parlay.findMany({
    where: { outcome: "PENDING" },
    select: {
      id: true,
      units: true,
      legs: {
        select: { outcome: true, oddsAmerican: true },
      },
    },
    take: 200,
  });

  let graded = 0;
  for (const parlay of parlays) {
    if (parlay.legs.length === 0) continue;
    if (parlay.legs.some((l) => l.outcome === "PENDING")) continue;

    const settlement = settleParlay(
      parlay.legs.map((l) => ({
        outcome: l.outcome,
        oddsAmerican: l.oddsAmerican,
      })),
      Number(parlay.units),
    );
    if (settlement.outcome === "PENDING") continue;

    await prisma.parlay.update({
      where: { id: parlay.id },
      data: {
        outcome: settlement.outcome,
        profitUnits: settlement.profitUnits,
        combinedOddsAmerican: settlement.effectiveOddsAmerican,
        gradedAt: new Date(),
      },
    });
    graded++;
  }

  return graded;
}

/**
 * Grade confidently-resolvable pending plays and parlays from settled results.
 * Call {@link snapshotClosingOdds} before this when invoked from cron.
 */
export async function autoGradePending(
  provider: ResultsProvider,
): Promise<AutoGradeResult> {
  const now = new Date();

  const straight = await gradeStraightPlays(provider, now);
  const legs = await gradeParlayLegs(provider, now);
  const parlaysGraded = await gradePendingParlays();

  return {
    graded: straight.graded + legs.graded,
    skipped: straight.skipped + legs.skipped,
    parlaysGraded,
    provider: provider.name,
  };
}
