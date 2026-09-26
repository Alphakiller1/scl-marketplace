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
import { clvPtsForGrade } from "@/lib/results/closing-snapshot";
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
  reportsOf,
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
import {
  ODDS_SCORES_ONLY_SPORTS,
  type ResultsProvider,
  type ResultsQueryScope,
} from "@/lib/results/provider";
import {
  publicationVerdict,
  tooEarlyToSettle,
} from "@/lib/results/publication-gate";
import { hasClvColumns } from "@/lib/results/schema-features";
import { lockParlaySettlement } from "@/lib/results/settlement-lock";
import { fetchWnbaOfficialPeriodBoxScore } from "@/lib/results/wnba-official";
import {
  classifySkipReason,
  emptySkipCounts,
  findSettledGame,
  type SkipReasonCounts,
} from "@/lib/results/skip-reason";

/** Max straight plays + parlay legs processed per grader round. */
const GRADE_BATCH_SIZE = 1_000;
/** Max parlay tickets settled per grader round. */
const PARLAY_BATCH_SIZE = 500;
/** Drain large backlogs within one cron invocation. */
const MAX_GRADE_ROUNDS = 15;

export type AutoGradeResult = {
  graded: number;
  /** Back-compat total of all skip reasons. */
  skipped: number;
  skippedByReason: SkipReasonCounts;
  parlaysGraded: number;
  clvSnapshots?: number;
  /** Published auto-grades re-checked this run, and how many were wrong. */
  reconciled?: ReconcileResult;
  provider: string;
};

export type AutoGradeOptions = {
  /**
   * Admin override: classify misses against the ESPN 14-day window so completed
   * events past the Odds API 3-day cliff still attempt to settle.
   */
  lookbackDays?: number;
};

type GradeBatch = {
  graded: number;
  skipped: number;
  skippedByReason: SkipReasonCounts;
};

type PlayerBoxCache = Map<string, Promise<PlayerBoxScore | null>>;
type FixtureCache = Map<string, Promise<RecoveredFixture | null>>;

function resultsQueryScopeFor(
  plays: readonly {
    sport: string;
    league?: string | null;
    eventStartsAt?: Date | null;
    createdAt?: Date;
  }[],
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
    tennisEventDates: [
      ...new Set(
        plays
          .filter((play) => play.sport === "TENNIS")
          .flatMap((play) => {
            const when = play.eventStartsAt ?? play.createdAt;
            return when
              ? [when.toISOString().slice(0, 10).replaceAll("-", "")]
              : [];
          }),
      ),
    ],
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
 * Markets that never settle from the full-game score: F3/F5/F7 segments,
 * period totals and player props. The one place that classification lives, so
 * the grader and the reconciler cannot disagree about what a market is.
 */
function settlesFromBoxScore(play: GradablePlay): boolean {
  return Boolean(parsePeriodMarket(play.market)) || isDeferredProp(play);
}

/**
 * Why a resolved outcome must not publish yet, or null when it may.
 *
 * A prop settled from a box score can arrive with no matched scoreboard game;
 * it still has to clear the kickoff floor, so a live box score never settles.
 */
function publicationHold(
  play: GradablePlay,
  game: SettledGame | null,
  now: Date,
): string | null {
  if (!game) {
    return tooEarlyToSettle(play, null, now)
      ? `${play.sport} play cannot be final yet`
      : null;
  }
  const verdict = publicationVerdict(play, game, now);
  if (verdict.ok) return null;
  console.warn("[auto-grade] publication held", {
    playId: play.id,
    block: verdict.block,
    detail: verdict.detail,
  });
  return verdict.detail;
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
  lookbackDays?: number,
): Promise<{
  outcome: Outcome | null;
  reason: keyof SkipReasonCounts;
  fixture: RecoveredFixture | null;
}> {
  const fixture = await cachedRecoveredFixture(fixtureCache, play, games);
  const boundPlay = fixture ? { ...play, ...fixture } : play;
  const matchedGame = findSettledGame(boundPlay, games);
  // Every outcome leaves through here, so no market can skip the gate.
  const publish = (outcome: Outcome, reason: keyof SkipReasonCounts) => {
    const held = publicationHold(boundPlay, matchedGame, now);
    if (held)
      return { outcome: null, reason: "awaiting_final" as const, fixture };
    return { outcome, reason, fixture };
  };
  if (matchedGame?.voided) {
    return publish("VOID", "market_unhandled");
  }
  if (settlesFromBoxScore(boundPlay)) {
    // F3/F5/F7 settle from line-scores only — never from the final score.
    // Period totals settle from line-scores; player props from the per-athlete
    // box score. Only a play neither resolver can settle still defers.
    const outcome = parsePeriodMarket(boundPlay.market)
      ? await resolvePeriodPlay(boundPlay, games)
      : ((await resolveDeferredPeriodTotal(boundPlay, games)) ??
        (await resolvePlayerPropPlay(boundPlay, games, boxCache)));
    if (outcome) return publish(outcome, "props_deferred");

    // Report WHY it deferred. `props_deferred` used to swallow "the results
    // feed has no such game" too, so a prop stuck on a missing fixture was
    // indistinguishable from one whose box score could not be read — and the
    // health report counted it as normal prop behaviour either way.
    const gameFound = matchedGame != null;
    return {
      outcome: null,
      reason: gameFound
        ? "props_deferred"
        : classifySkipReason({ play: boundPlay, gameFound, now, lookbackDays }),
      fixture,
    };
  }

  const outcome = resolveOutcome(boundPlay, games);
  if (outcome) return publish(outcome, "market_unhandled");
  return {
    outcome: null,
    reason: classifySkipReason({
      play: boundPlay,
      gameFound: findSettledGame(boundPlay, games) != null,
      now,
      lookbackDays,
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
  lookbackDays?: number,
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
      orderBy: [{ eventStartsAt: "asc" }, { createdAt: "asc" }],
      take: GRADE_BATCH_SIZE,
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
      lookbackDays,
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
    const clvPts = clvReady
      ? clvPtsForGrade(play.oddsAmerican, play.closingOddsAmerican)
      : null;
    const applied = await prisma.$transaction(async (tx) => {
      const updated = await tx.play.updateMany({
        where: { id: play.id, outcome: "PENDING" },
        data: {
          outcome,
          profitUnits,
          gradedAt: new Date(),
          ...(resolved.fixture ?? {}),
          ...(clvPts != null ? { clvPts } : {}),
        },
      });
      if (updated.count !== 1) return false;
      await tx.gradingAudit.create({
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
      });
      return true;
    });
    if (applied) graded++;
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
  lookbackDays?: number,
): Promise<GradeBatch> {
  const skippedByReason = emptySkipCounts();
  const pending = (
    await prisma.play.findMany({
      where: { outcome: "PENDING", parlayId: { not: null } },
      select: {
        id: true,
        parlayId: true,
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
      orderBy: [{ eventStartsAt: "asc" }, { createdAt: "asc" }],
      take: GRADE_BATCH_SIZE,
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
      lookbackDays,
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
    const applied = await prisma.$transaction(async (tx) => {
      await lockParlaySettlement(tx, play.parlayId!);
      const updated = await tx.play.updateMany({
        where: { id: play.id, outcome: "PENDING" },
        data: {
          outcome,
          profitUnits: 0,
          gradedAt: new Date(),
          ...(resolved.fixture ?? {}),
        },
      });
      if (updated.count !== 1) return false;
      await tx.gradingAudit.create({
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
      });
      return true;
    });
    if (applied) graded++;
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
    take: PARLAY_BATCH_SIZE,
  });

  let graded = 0;
  for (const parlay of parlays) {
    if (parlay.legs.length === 0) continue;
    if (parlay.legs.some((l) => l.outcome === "PENDING")) continue;

    const applied = await prisma.$transaction(async (tx) => {
      await lockParlaySettlement(tx, parlay.id);
      const fresh = await tx.parlay.findUnique({
        where: { id: parlay.id },
        select: {
          outcome: true,
          profitUnits: true,
          units: true,
          legs: { select: { outcome: true, oddsAmerican: true } },
        },
      });
      if (!fresh || fresh.outcome !== "PENDING" || fresh.legs.length === 0)
        return false;
      const settlement = settleParlay(
        fresh.legs.map((l) => ({
          outcome: l.outcome,
          oddsAmerican: l.oddsAmerican,
        })),
        Number(fresh.units),
      );
      if (settlement.outcome === "PENDING") return false;

      await tx.parlay.update({
        where: { id: parlay.id },
        data: {
          outcome: settlement.outcome,
          profitUnits: settlement.profitUnits,
          combinedOddsAmerican: settlement.effectiveOddsAmerican,
          gradedAt: new Date(),
        },
      });
      await tx.parlayGradingAudit.create({
        data: {
          parlayId: parlay.id,
          previousOutcome: fresh.outcome,
          newOutcome: settlement.outcome,
          previousProfitUnits: fresh.profitUnits,
          newProfitUnits: settlement.profitUnits,
          source: "AUTO",
          gradedById: null,
          reason: "Auto-settled from graded parlay legs",
        },
      });
      return true;
    });
    if (applied) graded++;
  }

  return graded;
}

/**
 * Grade confidently-resolvable pending plays and parlays from settled results.
 * Cron passes the credit-saving provider (no Odds API pricing). Admin Grade
 * completed passes the full scores stack plus a 14-day lookback so finished
 * events past the 3-day Odds API cliff still settle.
 */
export async function autoGradePending(
  provider: ResultsProvider,
  options: AutoGradeOptions = {},
): Promise<AutoGradeResult> {
  const now = new Date();
  const boxCache: PlayerBoxCache = new Map();
  const fixtureCache: FixtureCache = new Map();

  let graded = 0;
  let parlaysGraded = 0;
  let skippedByReason = emptySkipCounts();

  for (let round = 0; round < MAX_GRADE_ROUNDS; round++) {
    const roundResult = await autoGradePendingRound(
      provider,
      now,
      boxCache,
      fixtureCache,
      options.lookbackDays,
    );
    graded += roundResult.graded;
    parlaysGraded += roundResult.parlaysGraded;
    skippedByReason = roundResult.skippedByReason;

    const roundTotal = roundResult.graded + roundResult.parlaysGraded;
    if (roundTotal === 0) break;

    console.info("[auto-grade] round complete", {
      round: round + 1,
      graded: roundResult.graded,
      parlaysGraded: roundResult.parlaysGraded,
      skippedByReason: roundResult.skippedByReason,
    });
  }

  const reconciled = await reconcileRecentGrades(provider, now);

  const skipped = Object.values(skippedByReason).reduce((a, b) => a + b, 0);
  return {
    graded,
    skipped,
    skippedByReason,
    parlaysGraded,
    reconciled,
    provider: provider.name,
  };
}

/** How far back published auto-grades are re-checked against fresh finals. */
const RECONCILE_WINDOW_MS = 48 * 60 * 60 * 1_000;
/** A play the grader has already reversed this often is left to a human. */
const MAX_AUTO_CORRECTIONS = 1;
const AUTO_CORRECTION_PREFIX = "Auto-corrected";

export type ReconcileResult = {
  checked: number;
  corrected: number;
  /** Disagreements the grader will not fix itself (see reasons in the log). */
  needsHuman: number;
};

/**
 * Re-check every recent auto-grade against the latest finals, and fix the
 * ones that changed.
 *
 * Grading used to be fire-and-forget: once a play left PENDING nothing looked
 * at it again, so every wrong result stayed public until a capper complained
 * and an admin fixed it by hand. The Bucs misgrade sat for 17 hours. This pass
 * resolves each recent grade again from fresh data through the same matcher
 * and the same publication gate; when the confirmed answer differs, it
 * corrects the play (and its parlay) with an audit row naming both results.
 *
 * Never touches a play a human has graded or overridden, and gives up on a
 * play it has already reversed once — flip-flopping is a feed problem a human
 * should look at, not something to keep publishing. Straight markets only:
 * props and period markets settle from box scores this pass does not refetch.
 */
async function reconcileRecentGrades(
  provider: ResultsProvider,
  now: Date,
): Promise<ReconcileResult> {
  const result: ReconcileResult = { checked: 0, corrected: 0, needsHuman: 0 };
  const recent = await prisma.play.findMany({
    where: {
      gradedAt: { gte: new Date(now.getTime() - RECONCILE_WINDOW_MS) },
      outcome: { in: ["WIN", "LOSS", "PUSH", "VOID"] },
    },
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
      createdAt: true,
      side: true,
      line: true,
      league: true,
      outcome: true,
      profitUnits: true,
      parlayId: true,
      audits: {
        select: { source: true, reason: true },
        orderBy: { createdAt: "asc" },
      },
    },
    take: GRADE_BATCH_SIZE,
  });

  // Odds API scores cost credits on every call; those sports are re-checked
  // only when an admin runs "Grade completed", never on the cron cadence.
  const paidSports = new Set<string>(ODDS_SCORES_ONLY_SPORTS);
  const candidates = recent
    .map((p) => ({
      ...p,
      units: Number(p.units),
      line: p.line == null ? null : Number(p.line),
    }))
    .filter(
      (p) =>
        !paidSports.has(p.sport.toUpperCase()) &&
        p.audits.length > 0 &&
        p.audits.at(-1)!.source === "AUTO" &&
        !settlesFromBoxScore(p),
    );
  if (candidates.length === 0) return result;

  let games: SettledGame[];
  try {
    games = await provider.fetchSettledForSports(
      [...new Set(candidates.map((p) => p.sport))],
      resultsQueryScopeFor(candidates),
    );
  } catch (error) {
    console.error("[auto-grade] reconcile fetch failed", error);
    return result;
  }

  for (const play of candidates) {
    result.checked++;
    const game = findSettledGame(play, games);
    if (!game) continue;
    if (!publicationVerdict(play, game, now).ok) continue;
    const confirmed: Outcome | null = game.voided
      ? "VOID"
      : resolveOutcome(play, games);
    if (!confirmed || confirmed === play.outcome) continue;

    const corrections = play.audits.filter((a) =>
      a.reason?.startsWith(AUTO_CORRECTION_PREFIX),
    ).length;
    if (corrections >= MAX_AUTO_CORRECTIONS) {
      result.needsHuman++;
      console.error("[auto-grade] reconcile disagreement needs a human", {
        playId: play.id,
        published: play.outcome,
        confirmed,
      });
      continue;
    }

    const profitUnits = profitUnitsForOutcome(
      confirmed,
      play.oddsAmerican,
      play.units,
    );
    const final = `${game.away} ${game.awayScore} @ ${game.home} ${game.homeScore}`;
    const sources = reportsOf(game)
      .map((r) => r.source)
      .join("+");
    const applied = await prisma.$transaction(async (tx) => {
      const updated = await tx.play.updateMany({
        where: { id: play.id, outcome: play.outcome },
        data: { outcome: confirmed, profitUnits, gradedAt: new Date() },
      });
      if (updated.count !== 1) return false;
      await tx.gradingAudit.create({
        data: {
          playId: play.id,
          previousOutcome: play.outcome,
          newOutcome: confirmed,
          previousProfitUnits: play.profitUnits,
          newProfitUnits: profitUnits,
          source: "AUTO",
          gradedById: null,
          reason: `${AUTO_CORRECTION_PREFIX} ${play.outcome} -> ${confirmed}: confirmed final ${final} (${sources})`,
        },
      });
      if (play.parlayId) await resettleParlay(tx, play.parlayId);
      return true;
    });
    if (applied) {
      result.corrected++;
      console.warn("[auto-grade] corrected a published grade", {
        playId: play.id,
        from: play.outcome,
        to: confirmed,
        final,
        sources,
      });
    }
  }
  return result;
}

type GradeTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Re-derive a settled parlay after one of its legs was corrected. */
async function resettleParlay(tx: GradeTx, parlayId: string): Promise<void> {
  await lockParlaySettlement(tx, parlayId);
  const parlay = await tx.parlay.findUnique({
    where: { id: parlayId },
    select: {
      outcome: true,
      profitUnits: true,
      units: true,
      legs: { select: { outcome: true, oddsAmerican: true } },
    },
  });
  // PENDING tickets settle through the normal pass.
  if (!parlay || parlay.outcome === "PENDING") return;
  // A human's settlement of the ticket stands.
  const lastAudit = await tx.parlayGradingAudit.findFirst({
    where: { parlayId },
    orderBy: { createdAt: "desc" },
    select: { source: true },
  });
  if (lastAudit && lastAudit.source !== "AUTO") return;
  const settlement = settleParlay(
    parlay.legs.map((l) => ({
      outcome: l.outcome,
      oddsAmerican: l.oddsAmerican,
    })),
    Number(parlay.units),
  );
  if (settlement.outcome === parlay.outcome) return;
  await tx.parlay.update({
    where: { id: parlayId },
    data: {
      outcome: settlement.outcome,
      profitUnits: settlement.profitUnits,
      combinedOddsAmerican: settlement.effectiveOddsAmerican,
      gradedAt: settlement.outcome === "PENDING" ? null : new Date(),
    },
  });
  await tx.parlayGradingAudit.create({
    data: {
      parlayId,
      previousOutcome: parlay.outcome,
      newOutcome: settlement.outcome,
      previousProfitUnits: parlay.profitUnits,
      newProfitUnits: settlement.profitUnits,
      source: "AUTO",
      gradedById: null,
      reason: `${AUTO_CORRECTION_PREFIX}: a leg's published result was corrected`,
    },
  });
}

async function autoGradePendingRound(
  provider: ResultsProvider,
  now: Date,
  boxCache: PlayerBoxCache,
  fixtureCache: FixtureCache,
  lookbackDays?: number,
): Promise<AutoGradeResult> {
  // One immutable provider snapshot per round. The old straight/leg passes each
  // fetched independently, so an exhausted key could expose different games to
  // two plays bound to the same event during the very same grader invocation.
  const targets = await prisma.play.findMany({
    where: {
      outcome: "PENDING",
      OR: [{ eventStartsAt: null }, { eventStartsAt: { lte: now } }],
    },
    select: { sport: true, league: true, eventStartsAt: true, createdAt: true },
    take: GRADE_BATCH_SIZE * 2,
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
    lookbackDays,
  );
  const legs = await gradeParlayLegs(
    provider,
    now,
    boxCache,
    fixtureCache,
    games,
    lookbackDays,
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
