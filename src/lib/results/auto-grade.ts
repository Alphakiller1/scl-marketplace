import "server-only";

import type { Outcome } from "@prisma/client";

import { settleParlay } from "@/lib/grading";
import { profitUnitsForOutcome } from "@/lib/odds";
import { prisma } from "@/lib/prisma";
import { ensureClosingAndClv } from "@/lib/results/closing-snapshot";
import { isDeferredProp, resolveOutcome } from "@/lib/results/match";
import {
  parsePeriodTotal,
  resolvePeriodTotal,
} from "@/lib/results/prop-resolve";
import { fetchPeriodBoxScore } from "@/lib/results/stats-provider";
import type { ResultsProvider } from "@/lib/results/provider";
import { hasClvColumns } from "@/lib/results/schema-features";
import {
  classifySkipReason,
  emptySkipCounts,
  findSettledGame,
  type SkipReasonCounts,
} from "@/lib/results/skip-reason";

export type AutoGradeResult = {
  graded: number;
  /** Back-compat total of all skip reasons. */
  skipped: number;
  skippedByReason: SkipReasonCounts;
  parlaysGraded: number;
  clvSnapshots?: number;
  provider: string;
};

type GradeBatch = {
  graded: number;
  skipped: number;
  skippedByReason: SkipReasonCounts;
};

function logSkip(
  kind: "play" | "parlay leg",
  play: {
    id: string;
    sport: string;
    eventId?: string | null;
  },
  reason: keyof SkipReasonCounts,
) {
  console.info(
    `[auto-grade] ${kind} ${play.id} skipped: ${reason}` +
      ` sport=${play.sport} eventId=${play.eventId ?? "null"}`,
  );
}

/**
 * Auto-grade the subset of `isDeferredProp` plays we CAN settle without a
 * player-stats feed: First-Five / first-N-innings totals, from box-score
 * line-scores. Returns null (→ still defer) for everything else — player props,
 * missing eventId, or incomplete line-scores — so this never settles on a guess.
 */
async function resolveDeferredPeriodTotal(play: {
  sport: string;
  selection: string;
  eventId?: string | null;
}): Promise<Outcome | null> {
  if (!play.eventId || !parsePeriodTotal(play.selection)) return null;
  const box = await fetchPeriodBoxScore(play.sport, play.eventId);
  if (!box) return null;
  return resolvePeriodTotal(play.selection, box);
}

async function gradeStraightPlays(
  provider: ResultsProvider,
  now: Date,
): Promise<GradeBatch> {
  const clvReady = await hasClvColumns();
  const skippedByReason = emptySkipCounts();
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
        book: true,
        league: true,
        ...(clvReady ? { closingOddsAmerican: true } : {}),
      },
      take: 500,
    })
  )
    .map((p) => ({
      ...p,
      units: Number(p.units),
      line: p.line == null ? null : Number(p.line),
      closingOddsAmerican:
        "closingOddsAmerican" in p
          ? ((p as { closingOddsAmerican?: number | null })
              .closingOddsAmerican ?? null)
          : null,
    }))
    .filter(
      (p) =>
        p.eventStartsAt == null || p.eventStartsAt.getTime() <= now.getTime(),
    );

  if (pending.length === 0) {
    return { graded: 0, skipped: 0, skippedByReason };
  }

  const sports = [...new Set(pending.map((p) => p.sport))];
  const games = await provider.fetchSettledForSports(sports);
  let graded = 0;

  for (const play of pending) {
    let outcome: Outcome | null;
    if (isDeferredProp(play)) {
      // Period totals (First-Five / innings) settle from box-score line-scores;
      // everything else (player props) still defers to the manual backup.
      outcome = await resolveDeferredPeriodTotal(play);
      if (!outcome) {
        skippedByReason.props_deferred++;
        logSkip("play", play, "props_deferred");
        continue;
      }
    } else {
      const game = findSettledGame(play, games);
      outcome = resolveOutcome(play, games);
      if (!outcome) {
        const reason = classifySkipReason({
          play,
          gameFound: game != null,
          now,
        });
        skippedByReason[reason]++;
        logSkip("play", play, reason);
        continue;
      }
    }
    const profitUnits = profitUnitsForOutcome(
      outcome,
      play.oddsAmerican,
      play.units,
    );
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
          closingOddsAmerican: play.closingOddsAmerican,
        })
      : { closingOddsAmerican: null, clvPts: null };
    await prisma.$transaction([
      prisma.play.update({
        where: { id: play.id },
        data: {
          outcome,
          profitUnits,
          gradedAt: new Date(),
          ...(clv.clvPts != null ? { clvPts: clv.clvPts } : {}),
          ...(clv.closingOddsAmerican != null &&
          play.closingOddsAmerican == null
            ? {
                closingOddsAmerican: clv.closingOddsAmerican,
                closingCapturedAt: new Date(),
              }
            : {}),
        },
        select: { id: true },
      }),
      prisma.gradingAudit.create({
        data: {
          playId: play.id,
          previousOutcome: "PENDING",
          newOutcome: outcome,
          previousProfitUnits: null,
          newProfitUnits: profitUnits,
          source: "AUTO",
          gradedById: null,
          reason: `Auto-graded from ${provider.name} settled results`,
        },
      }),
    ]);
    graded++;
  }

  const skipped = Object.values(skippedByReason).reduce((a, b) => a + b, 0);
  return { graded, skipped, skippedByReason };
}

async function gradeParlayLegs(
  provider: ResultsProvider,
  now: Date,
): Promise<GradeBatch> {
  const skippedByReason = emptySkipCounts();
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

  if (pending.length === 0) {
    return { graded: 0, skipped: 0, skippedByReason };
  }

  const sports = [...new Set(pending.map((p) => p.sport))];
  const games = await provider.fetchSettledForSports(sports);
  let graded = 0;

  for (const play of pending) {
    if (isDeferredProp(play)) {
      skippedByReason.props_deferred++;
      logSkip("parlay leg", play, "props_deferred");
      continue;
    }
    const game = findSettledGame(play, games);
    const outcome = resolveOutcome(play, games);
    if (!outcome) {
      const reason = classifySkipReason({
        play,
        gameFound: game != null,
        now,
      });
      skippedByReason[reason]++;
      logSkip("parlay leg", play, reason);
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
        select: { id: true },
      }),
      prisma.gradingAudit.create({
        data: {
          playId: play.id,
          previousOutcome: "PENDING",
          newOutcome: outcome,
          previousProfitUnits: null,
          newProfitUnits: 0,
          source: "AUTO",
          gradedById: null,
          reason: `Auto-graded parlay leg from ${provider.name} settled results`,
        },
      }),
    ]);
    graded++;
  }

  const skipped = Object.values(skippedByReason).reduce((a, b) => a + b, 0);
  return { graded, skipped, skippedByReason };
}

function mergeSkipCounts(
  a: SkipReasonCounts,
  b: SkipReasonCounts,
): SkipReasonCounts {
  return {
    props_deferred: a.props_deferred + b.props_deferred,
    event_not_found: a.event_not_found + b.event_not_found,
    aged_out: a.aged_out + b.aged_out,
    market_unhandled: a.market_unhandled + b.market_unhandled,
  };
}

async function gradePendingParlays(): Promise<number> {
  const parlays = await prisma.parlay.findMany({
    where: { outcome: "PENDING" },
    select: {
      id: true,
      units: true,
      outcome: true,
      profitUnits: true,
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

    await prisma.$transaction([
      prisma.parlay.update({
        where: { id: parlay.id },
        data: {
          outcome: settlement.outcome,
          profitUnits: settlement.profitUnits,
          combinedOddsAmerican: settlement.effectiveOddsAmerican,
          gradedAt: new Date(),
        },
      }),
      prisma.parlayGradingAudit.create({
        data: {
          parlayId: parlay.id,
          previousOutcome: parlay.outcome,
          newOutcome: settlement.outcome,
          previousProfitUnits: parlay.profitUnits,
          newProfitUnits: settlement.profitUnits,
          source: "AUTO",
          gradedById: null,
          reason: "Auto-settled from graded parlay legs",
        },
      }),
    ]);
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
  const skippedByReason = mergeSkipCounts(
    straight.skippedByReason,
    legs.skippedByReason,
  );

  return {
    graded: straight.graded + legs.graded,
    skipped: straight.skipped + legs.skipped,
    skippedByReason,
    parlaysGraded,
    provider: provider.name,
  };
}
