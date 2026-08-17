import "server-only";

import type { Outcome } from "@prisma/client";

import { settleParlay } from "@/lib/grading";
import { profitUnitsForOutcome } from "@/lib/odds";
import { loadCachedEventBoard } from "@/lib/odds-event-board-cache";
import { loadOddsEventIdentity } from "@/lib/odds-event-identity-cache";
import { prisma } from "@/lib/prisma";
import {
  recoverFixtureFromIdentity,
  recoverFixtureFromSelections,
  type RecoveredFixture,
} from "@/lib/results/cached-fixture";
import { ensureClosingAndClv } from "@/lib/results/closing-snapshot";
import { parsePeriodMarket } from "@/lib/period-markets";
import {
  isDeferredProp,
  parseSpreadFromSelection,
  pickedSideForGame,
  resolveOutcome,
  type GradablePlay,
} from "@/lib/results/match";
import {
  espnIdForFixture,
  mlbGamePkForFixture,
  type SettledGame,
} from "@/lib/results/settled-game";
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
  fetchMlbOfficialPlayerBoxScore,
} from "@/lib/results/stats-provider";
import {
  findPlayer,
  playerNameFromSelection,
  playerPropCandidateEventIds,
  resolvePlayerProp,
  type PlayerBoxScore,
} from "@/lib/results/player-props";
import type {
  ResultsProvider,
  ResultsQueryScope,
} from "@/lib/results/provider";
import { hasClvColumns } from "@/lib/results/schema-features";
import { fetchWnbaOfficialPeriodBoxScore } from "@/lib/results/wnba-official";
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

type PlayerBoxCache = Map<string, Promise<PlayerBoxScore | null>>;
type FixtureCache = Map<string, Promise<RecoveredFixture | null>>;

function resultsQueryScopeFor(
  plays: readonly { sport: string; league?: string | null }[],
): ResultsQueryScope {
  const tagsFor = (sport: string) => [
    ...new Set(
      plays
        .filter((play) => play.sport === sport)
        .map((play) => play.league?.trim())
        .filter((league): league is string => Boolean(league)),
    ),
  ];
  return {
    soccerLeagues: tagsFor("SOCCER"),
    tennisTours: tagsFor("TENNIS"),
  };
}

function cachedPlayerBox(
  cache: PlayerBoxCache,
  sport: string,
  espnId: string,
): Promise<PlayerBoxScore | null> {
  const key = `${sport.toUpperCase()}:${espnId}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const pending = fetchPlayerBoxScore(sport, espnId);
  cache.set(key, pending);
  return pending;
}

function cachedMlbOfficialBox(
  cache: PlayerBoxCache,
  gamePk: string,
): Promise<PlayerBoxScore | null> {
  const key = `MLB-OFFICIAL:${gamePk}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const pending = fetchMlbOfficialPlayerBoxScore(gamePk);
  cache.set(key, pending);
  return pending;
}

function cachedRecoveredFixture(
  cache: FixtureCache,
  play: GradablePlay,
  games: SettledGame[],
): Promise<RecoveredFixture | null> {
  if (!play.eventId || findSettledGame(play, games)) {
    return Promise.resolve(null);
  }
  const key = `${play.sport.toUpperCase()}:${play.eventId}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const pending = loadOddsEventIdentity(play.sport, play.eventId)
    .then(async (identity) => {
      const archived = identity
        ? recoverFixtureFromIdentity(play, identity, games)
        : null;
      if (archived) return archived;
      const board = await loadCachedEventBoard(play.sport, play.eventId!);
      return recoverFixtureFromSelections(play, board.selections, games);
    })
    .catch((error) => {
      console.warn("[auto-grade] cached fixture recovery failed", {
        sport: play.sport,
        eventId: play.eventId,
        reason: error instanceof Error ? error.message : String(error),
      });
      return null;
    });
  cache.set(key, pending);
  return pending;
}

function logSkip(
  kind: "play" | "parlay leg",
  play: GradablePlay,
  reason: keyof SkipReasonCounts,
) {
  console.info(
    `[auto-grade] ${kind} ${play.id} skipped: ${reason}` +
      ` sport=${play.sport} eventId=${play.eventId ?? "null"}`,
  );
  const startsAt = play.eventStartsAt;
  if (startsAt && startsAt.getTime() < Date.now() - 24 * 60 * 60 * 1_000) {
    console.warn("[auto-grade] delayed play diagnostic", {
      kind,
      id: play.id,
      sport: play.sport,
      market: play.market,
      selection: play.selection,
      eventId: play.eventId ?? null,
      eventLabel: play.eventLabel ?? null,
      eventStartsAt: startsAt.toISOString(),
      reason,
    });
  }
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
  const box = await periodBoxScoreFor(play, games);
  if (!box) return null;
  return resolvePeriodTotal(play.selection, box);
}

async function periodBoxScoreFor(play: GradablePlay, games: SettledGame[]) {
  const game = findSettledGame(play, games);
  if (!game) return null;
  if (game.homePeriods?.length && game.awayPeriods?.length) {
    return {
      homePeriods: game.homePeriods,
      awayPeriods: game.awayPeriods,
    };
  }
  if (game.wnbaGameSlug) {
    const official = await fetchWnbaOfficialPeriodBoxScore(game.wnbaGameSlug);
    if (official) return official;
  }
  const espnId = espnIdForFixture(game, games);
  return espnId ? fetchPeriodBoxScore(play.sport, espnId) : null;
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
  boxCache: PlayerBoxCache,
): Promise<Outcome | null> {
  const matchedGame = findSettledGame(play, games);
  const espnId = espnEventIdFor(play, games);
  if (espnId) {
    const box = await cachedPlayerBox(boxCache, play.sport, espnId);
    if (box) {
      const outcome = resolvePlayerProp(
        {
          market: play.market,
          selection: play.selection,
          side: play.side,
          line: play.line ?? null,
        },
        box,
      );
      if (outcome) return outcome;
    }
  }

  // Plan C is genuinely independent of ESPN: match the same final fixture to
  // MLB's official gamePk and read the official box score.
  const gamePk = matchedGame ? mlbGamePkForFixture(matchedGame, games) : null;
  if (play.sport.toUpperCase() === "MLB" && gamePk) {
    const box = await cachedMlbOfficialBox(boxCache, gamePk);
    if (box) {
      const outcome = resolvePlayerProp(
        {
          market: play.market,
          selection: play.selection,
          side: play.side,
          line: play.line ?? null,
        },
        box,
      );
      if (outcome) return outcome;
    }
  }

  // Legacy picker rows can carry the Odds API id and scheduled start but no
  // club metadata. Inspect only nearby settled games, then require the named
  // athlete to occur in exactly one box score. Ambiguous/missing stays pending.
  const playerName = playerNameFromSelection(play.selection);
  if (!playerName) return null;
  const candidateIds = playerPropCandidateEventIds(play, games);
  const candidates = await Promise.all(
    candidateIds.map(async (candidateId) => ({
      box: await cachedPlayerBox(boxCache, play.sport, candidateId),
    })),
  );
  const matches = candidates.filter(({ box }) => {
    if (!box) return false;
    const player = findPlayer(box, playerName);
    return player !== null && player !== "AMBIGUOUS";
  });
  if (matches.length !== 1 || !matches[0]!.box) return null;
  const box = matches[0]!.box;
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
  if (!period) return null;

  const game = findSettledGame(play, games);
  if (!game) return null;
  const rawBox = await periodBoxScoreFor(play, games);
  if (!rawBox) return null;
  const isHalf = period.innings === 0;
  const secondHalf = /\b(2nd|second)\s*half\b|\bh2\b/i.test(play.market);
  const box = isHalf
    ? {
        homePeriods: rawBox.homePeriods.slice(
          secondHalf ? 2 : 0,
          secondHalf ? 4 : 2,
        ),
        awayPeriods: rawBox.awayPeriods.slice(
          secondHalf ? 2 : 0,
          secondHalf ? 4 : 2,
        ),
      }
    : rawBox;
  const segmentPeriods = isHalf ? 2 : period.innings;

  if (period.kind === "total") {
    // The segment is already known from the market, so the line/side only has
    // to be read off the selection ("Over 4.5").
    const scores = periodScores(box, segmentPeriods);
    if (!scores) return null;
    if (isHalf) {
      const side =
        /^under$/i.test(play.side ?? "") ||
        /\bunder\b|\bu\s*\d/i.test(play.selection)
          ? "under"
          : /^over$/i.test(play.side ?? "") ||
              /\bover\b|\bo\s*\d/i.test(play.selection)
            ? "over"
            : null;
      const line =
        play.line ??
        Number(
          play.selection.match(
            /(?:over|under|\bo|\bu)\s*([0-9]+(?:\.[0-9]+)?)/i,
          )?.[1],
        );
      if (!side || !Number.isFinite(line)) return null;
      return overUnderOutcome(scores.home + scores.away, line, side);
    }
    const parsed = parsePeriodTotal(
      `first ${period.innings} innings ${play.selection}`,
    );
    if (!parsed) return null;
    return overUnderOutcome(
      scores.home + scores.away,
      parsed.line,
      parsed.side,
    );
  }

  const side = pickedSideForGame(play, game);
  if (side === undefined) return null;

  if (period.kind === "spread") {
    const line = play.line ?? parseSpreadFromSelection(play.selection)?.line;
    if (line == null || Number.isNaN(line) || side === null) return null;
    return resolvePeriodSpread(box, segmentPeriods, side, line);
  }
  if (period.kind === "moneyline") {
    return resolvePeriodMoneyline(box, segmentPeriods, side);
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
  boxCache: PlayerBoxCache,
  fixtureCache: FixtureCache,
): Promise<{
  outcome: Outcome | null;
  reason: keyof SkipReasonCounts;
  fixture: RecoveredFixture | null;
}> {
  const fixture = await cachedRecoveredFixture(fixtureCache, play, games);
  const boundPlay = fixture ? { ...play, ...fixture } : play;
  const deferredMarket =
    parsePeriodMarket(boundPlay.market) || isDeferredProp(boundPlay);
  if (deferredMarket) {
    // F3/F5/F7 settle from line-scores only — never from the final score.
    // Period totals settle from line-scores; player props from the per-athlete
    // box score. Only a play neither resolver can settle still defers.
    const outcome = parsePeriodMarket(boundPlay.market)
      ? await resolvePeriodPlay(boundPlay, games)
      : ((await resolveDeferredPeriodTotal(boundPlay, games)) ??
        (await resolvePlayerPropPlay(boundPlay, games, boxCache)));
    if (outcome) return { outcome, reason: "props_deferred", fixture };

    // Report WHY it deferred. `props_deferred` used to swallow "the results
    // feed has no such game" too, so a prop stuck on a missing fixture was
    // indistinguishable from one whose box score could not be read — and the
    // health report counted it as normal prop behaviour either way.
    const gameFound = findSettledGame(boundPlay, games) != null;
    return {
      outcome: null,
      reason: gameFound
        ? "props_deferred"
        : classifySkipReason({ play: boundPlay, gameFound, now }),
      fixture,
    };
  }

  const outcome = resolveOutcome(boundPlay, games);
  if (outcome) return { outcome, reason: "market_unhandled", fixture };
  return {
    outcome: null,
    reason: classifySkipReason({
      play: boundPlay,
      gameFound: findSettledGame(boundPlay, games) != null,
      now,
    }),
    fixture,
  };
}

async function gradeStraightPlays(
  provider: ResultsProvider,
  now: Date,
  boxCache: PlayerBoxCache,
  fixtureCache: FixtureCache,
  games: SettledGame[],
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

  let graded = 0;

  for (const play of pending) {
    const resolved = await resolvePendingPlay(
      play,
      games,
      now,
      boxCache,
      fixtureCache,
    );
    if (!resolved.outcome) {
      if (
        resolved.fixture &&
        (!play.homeTeam || !play.awayTeam || !play.eventLabel)
      ) {
        await prisma.play.update({
          where: { id: play.id },
          data: resolved.fixture,
          select: { id: true },
        });
      }
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
          ...(resolved.fixture ?? {}),
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
  boxCache: PlayerBoxCache,
  fixtureCache: FixtureCache,
  games: SettledGame[],
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
        league: true,
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

  let graded = 0;

  for (const play of pending) {
    const resolved = await resolvePendingPlay(
      play,
      games,
      now,
      boxCache,
      fixtureCache,
    );
    if (!resolved.outcome) {
      if (
        resolved.fixture &&
        (!play.homeTeam || !play.awayTeam || !play.eventLabel)
      ) {
        await prisma.play.update({
          where: { id: play.id },
          data: resolved.fixture,
          select: { id: true },
        });
      }
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
          ...(resolved.fixture ?? {}),
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
    awaiting_final: a.awaiting_final + b.awaiting_final,
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
  const boxCache: PlayerBoxCache = new Map();
  const fixtureCache: FixtureCache = new Map();

  // One immutable provider snapshot per job. The old straight/leg passes each
  // fetched independently, so an exhausted key could expose different games to
  // two plays bound to the same event during the very same grader invocation.
  const targets = await prisma.play.findMany({
    where: {
      outcome: "PENDING",
      OR: [{ eventStartsAt: null }, { eventStartsAt: { lte: now } }],
    },
    select: { sport: true, league: true },
    take: 1_000,
  });
  const sports = [...new Set(targets.map((play) => play.sport))];
  const games = sports.length
    ? await provider.fetchSettledForSports(
        sports,
        resultsQueryScopeFor(targets),
      )
    : [];

  const straight = await gradeStraightPlays(
    provider,
    now,
    boxCache,
    fixtureCache,
    games,
  );
  const legs = await gradeParlayLegs(
    provider,
    now,
    boxCache,
    fixtureCache,
    games,
  );
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
