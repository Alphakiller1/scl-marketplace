import "server-only";

import type { Outcome } from "@prisma/client";

import { settleParlay } from "@/lib/grading";
import { profitUnitsForOutcome } from "@/lib/odds";
import { prisma } from "@/lib/prisma";
import { ensureClosingAndClv } from "@/lib/results/closing-snapshot";
import { parsePeriodMarket } from "@/lib/period-markets";
import {
  isDeferredProp,
  parseSpreadFromSelection,
  pickedSideForGame,
  resolveOutcome,
  type GradablePlay,
} from "@/lib/results/match";
import { espnIdForFixture, type SettledGame } from "@/lib/results/settled-game";
import {
  overUnderOutcome,
  parsePeriodTotal,
  periodScores,
  resolvePeriodMoneyline,
  resolvePeriodSpread,
  resolvePeriodTotal,
} from "@/lib/results/prop-resolve";
import {
  fetchPeriodBoxScore,
  fetchPlayerBoxScore,
} from "@/lib/results/stats-provider";
import { resolvePlayerProp } from "@/lib/results/player-props";
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
async function resolveDeferredPeriodTotal(
  play: GradablePlay,
  games: SettledGame[],
): Promise<Outcome | null> {
  if (!parsePeriodTotal(play.selection)) return null;
  const espnId = espnEventIdFor(play, games);
  if (!espnId) return null;
  const box = await fetchPeriodBoxScore(play.sport, espnId);
  if (!box) return null;
  return resolvePeriodTotal(play.selection, box);
}

/**
 * ESPN's numeric event id for a play, read off the settled game it matches.
 *
 * `Play.eventId` is an **Odds API hash** — in production every bound play
 * carries a 32-char hex id and not one carries an ESPN id. Passing that to
 * ESPN's summary endpoint 404s, which is why box-score grading had never
 * settled a single play. The ESPN provider stamps its id onto the games it
 * returns and `mergeSettledGames` carries it onto the Odds API copy that wins
 * the merge, so the matched game has the id we actually need whichever feed
 * reported the fixture.
 */
function espnEventIdFor(
  play: GradablePlay,
  games: SettledGame[],
): string | null {
  const game = findSettledGame(play, games);
  return game ? espnIdForFixture(game, games) : null;
}

/**
 * Settle a player prop from the box score, or defer.
 *
 * This is the class of play that used to route straight to the manual queue:
 * every prop stayed PENDING until someone graded it by hand, so the backlog
 * rebuilt itself every single day.
 */
async function resolvePlayerPropPlay(
  play: GradablePlay,
  games: SettledGame[],
): Promise<Outcome | null> {
  const espnId = espnEventIdFor(play, games);
  if (!espnId) return null;
  const box = await fetchPlayerBoxScore(play.sport, espnId);
  if (!box) return null;
  return resolvePlayerProp(
    {
      market: play.market,
      selection: play.selection,
      side: play.side,
      line: play.line ?? null,
    },
    box,
  );
}

/**
 * Settle a first-N-innings play (F3/F5/F7) from box-score line-scores.
 *
 * The settled game is used ONLY to work out which club the capper backed — the
 * result comes entirely from the line-scores, never the final score. Returns
 * null (→ defer) whenever the segment can't be settled with confidence: no
 * event, no line-scores yet, an unreadable side, or a tied moneyline segment.
 */
async function resolvePeriodPlay(
  play: GradablePlay,
  games: SettledGame[],
): Promise<Outcome | null> {
  const period = parsePeriodMarket(play.market);
  // innings <= 0 is a half: recognised as a partial-game market (so it is never
  // graded on the full-game score) but not yet settleable, because the box-score
  // provider only maps baseball line-scores.
  if (!period || period.innings <= 0) return null;

  const espnId = espnEventIdFor(play, games);
  if (!espnId) return null;
  const box = await fetchPeriodBoxScore(play.sport, espnId);
  if (!box) return null;

  if (period.kind === "total") {
    // The segment is already known from the market, so the line/side only has
    // to be read off the selection ("Over 4.5").
    const parsed = parsePeriodTotal(
      `first ${period.innings} innings ${play.selection}`,
    );
    if (!parsed) return null;
    const scores = periodScores(box, period.innings);
    if (!scores) return null;
    return overUnderOutcome(
      scores.home + scores.away,
      parsed.line,
      parsed.side,
    );
  }

  const game = findSettledGame(play, games);
  if (!game) return null;
  const side = pickedSideForGame(play, game);
  if (side === undefined) return null;

  if (period.kind === "spread") {
    const line = play.line ?? parseSpreadFromSelection(play.selection)?.line;
    if (line == null || Number.isNaN(line) || side === null) return null;
    return resolvePeriodSpread(box, period.innings, side, line);
  }
  if (period.kind === "moneyline") {
    return resolvePeriodMoneyline(box, period.innings, side);
  }
  // Segment known but not the market kind (carried-over "First Five Innings"
  // rows) — only the total form is safe to infer, from the selection text.
  return resolvePeriodTotal(play.selection, box);
}

/**
 * Turn one pending play into an outcome — the ONE path, for straight plays and
 * parlay legs alike.
 *
 * The two used to be written out separately and drifted: the parlay branch
 * deferred every prop unconditionally, so a prop that graded fine on its own
 * sat PENDING forever inside a parlay and held the whole ticket unsettled. A
 * shared resolver makes that divergence impossible rather than merely fixed.
 *
 * A null outcome always carries the skip reason to record, so no caller has to
 * decide what a deferral means.
 */
async function resolvePendingPlay(
  play: GradablePlay,
  games: SettledGame[],
  now: Date,
): Promise<{ outcome: Outcome | null; reason: keyof SkipReasonCounts }> {
  const deferredMarket = parsePeriodMarket(play.market) || isDeferredProp(play);
  if (deferredMarket) {
    // F3/F5/F7 settle from line-scores only — never from the final score.
    // Period totals settle from line-scores; player props from the per-athlete
    // box score. Only a play neither resolver can settle still defers.
    const outcome = parsePeriodMarket(play.market)
      ? await resolvePeriodPlay(play, games)
      : ((await resolveDeferredPeriodTotal(play, games)) ??
        (await resolvePlayerPropPlay(play, games)));
    if (outcome) return { outcome, reason: "props_deferred" };

    // Report WHY it deferred. `props_deferred` used to swallow "the results
    // feed has no such game" too, so a prop stuck on a missing fixture was
    // indistinguishable from one whose box score could not be read — and the
    // health report counted it as normal prop behaviour either way.
    const gameFound = findSettledGame(play, games) != null;
    return {
      outcome: null,
      reason: gameFound
        ? "props_deferred"
        : classifySkipReason({ play, gameFound, now }),
    };
  }

  const outcome = resolveOutcome(play, games);
  if (outcome) return { outcome, reason: "market_unhandled" };
  return {
    outcome: null,
    reason: classifySkipReason({
      play,
      gameFound: findSettledGame(play, games) != null,
      now,
    }),
  };
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
        eventLabel: true,
        eventStartsAt: true,
        homeTeam: true,
        awayTeam: true,
        // Date-scopes the name-matching fallback for plays with no eventId.
        // Imported legacy plays carry the event time here.
        createdAt: true,
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
    const resolved = await resolvePendingPlay(play, games, now);
    if (!resolved.outcome) {
      skippedByReason[resolved.reason]++;
      logSkip("play", play, resolved.reason);
      continue;
    }
    const outcome = resolved.outcome;
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
        eventLabel: true,
        eventStartsAt: true,
        homeTeam: true,
        awayTeam: true,
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
    const resolved = await resolvePendingPlay(play, games, now);
    if (!resolved.outcome) {
      skippedByReason[resolved.reason]++;
      logSkip("parlay leg", play, resolved.reason);
      continue;
    }
    const outcome = resolved.outcome;
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
