/**
 * Correct one pick for one capper, or for every capper who logged it.
 *
 * Two questions, both pure so they are unit-tested and so the admin preview and
 * the server run the exact same arithmetic:
 *
 *   1. Which plays are "that play"? (`classifyCandidates`)
 *   2. What does applying an outcome to them do to each straight bet and each
 *      parlay ticket? (`planCorrection`)
 *
 * Matching is deliberately strict. A wrong W/L on a public verified record is
 * the worst thing this tool can do, so "the same play" means the same game, the
 * same market and the same selection text — which, for a player prop, is the
 * only field that names the player (`side` is just "Over"). Picks on the same
 * game that differ by line or side are offered separately as *related*, and only
 * a void may be applied to them: a void does not depend on the line, a win or a
 * loss does.
 */
import type { Outcome } from "@prisma/client";

import { settleParlay } from "@/lib/grading";
import { profitUnitsEqual } from "@/lib/grading-correction";
import { isGameLineMarket } from "@/lib/market-kind";
import { profitUnitsForOutcome, round2 } from "@/lib/odds";
import { extractPlayerName } from "@/lib/player-headshots";

export type CorrectionOutcome = Exclude<Outcome, "PENDING">;

/** A leg's sibling on the same ticket — all a re-settlement needs. */
export type CorrectionParlayLeg = {
  id: string;
  outcome: Outcome;
  oddsAmerican: number;
};

/** A play that might be corrected, flattened for the matcher and the planner. */
export type CorrectionPlay = {
  id: string;
  capperId: string;
  /** "@handle" (or a display name) — what the admin reads in the list. */
  capperLabel: string;
  sport: string;
  market: string;
  selection: string;
  side: string | null;
  line: number | null;
  eventId: string | null;
  eventLabel: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  /** ISO strings: this crosses the server → client component boundary. */
  eventStartsAt: string | null;
  createdAt: string;
  oddsAmerican: number;
  /** Stored stake, exactly as `gradePlayAction` reads it. */
  units: number;
  outcome: Outcome;
  profitUnits: number | null;
  /** Set when this play is a parlay leg: the ticket it belongs to. */
  parlay: {
    id: string;
    units: number;
    outcome: Outcome;
    profitUnits: number | null;
    legs: CorrectionParlayLeg[];
  } | null;
};

export type CandidateMatch = "exact" | "related";

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/** Case, accent, dash and whitespace folding — never anything looser. */
export function normalizePickText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[−‒–—]/g, "-")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Two picks without a shared provider id are the same game only when the same
 * clubs meet within this window. Tight enough that the two halves of a
 * doubleheader (game 2 is listed ~3h+ after game 1) never merge.
 */
export const FIXTURE_WINDOW_MS = 2 * 60 * 60 * 1000;

function startOf(play: CorrectionPlay): number | null {
  // Legacy imports carry first pitch in createdAt (see `pickEventDate`), and
  // they are the only rows without an eventId — so for an unbound play the
  // creation time is the event time.
  const raw = play.eventStartsAt ?? (play.eventId ? null : play.createdAt);
  if (!raw) return null;
  const time = new Date(raw).getTime();
  return Number.isNaN(time) ? null : time;
}

/** Same game: same provider event id, or — only when one side has no id — same clubs at the same time. */
export function sameEvent(a: CorrectionPlay, b: CorrectionPlay): boolean {
  if (a.eventId && b.eventId) return a.eventId === b.eventId;
  const aHome = normalizePickText(a.homeTeam);
  const aAway = normalizePickText(a.awayTeam);
  if (!aHome || !aAway) return false;
  if (
    aHome !== normalizePickText(b.homeTeam) ||
    aAway !== normalizePickText(b.awayTeam)
  ) {
    return false;
  }
  const aStart = startOf(a);
  const bStart = startOf(b);
  if (aStart == null || bStart == null) return false;
  return Math.abs(aStart - bStart) <= FIXTURE_WINDOW_MS;
}

function sameNullable(
  a: string | number | null,
  b: string | number | null,
  normalize: (value: string | number) => string | number,
): boolean {
  if (a == null || b == null) return true;
  return normalize(a) === normalize(b);
}

/** The same bet: same game, market, selection text, and (where stored) side and line. */
export function samePick(a: CorrectionPlay, b: CorrectionPlay): boolean {
  return (
    sameEvent(a, b) &&
    normalizePickText(a.market) === normalizePickText(b.market) &&
    normalizePickText(a.selection) === normalizePickText(b.selection) &&
    sameNullable(a.side, b.side, (v) => normalizePickText(String(v))) &&
    sameNullable(a.line, b.line, (v) => Math.round(Number(v) * 100))
  );
}

/** The player a prop is about, or null for a game line / unparseable text. */
export function propPlayer(play: CorrectionPlay): string | null {
  if (isGameLineMarket(play.market)) return null;
  const name = extractPlayerName(play.selection);
  return name ? normalizePickText(name) : null;
}

/**
 * Same game, not the same bet, but plausibly covered by the same ruling:
 * - a player prop: any prop on the same player (other stat, line, or side) —
 *   the set an injury void normally covers;
 * - a game line: the same market at another line or on the other side.
 */
export function relatedPick(
  source: CorrectionPlay,
  other: CorrectionPlay,
): boolean {
  if (!sameEvent(source, other) || samePick(source, other)) return false;
  const player = propPlayer(source);
  if (player) return propPlayer(other) === player;
  return normalizePickText(source.market) === normalizePickText(other.market);
}

export type ClassifiedCandidates = {
  /** The source pick first, then every other capper's identical pick. */
  exact: CorrectionPlay[];
  related: CorrectionPlay[];
};

function byCapperThenId(a: CorrectionPlay, b: CorrectionPlay): number {
  return (
    a.capperLabel.localeCompare(b.capperLabel, "en", { sensitivity: "base" }) ||
    a.id.localeCompare(b.id)
  );
}

export function classifyCandidates(
  source: CorrectionPlay,
  pool: readonly CorrectionPlay[],
): ClassifiedCandidates {
  const seen = new Set<string>([source.id]);
  const exact: CorrectionPlay[] = [];
  const related: CorrectionPlay[] = [];
  for (const play of pool) {
    if (seen.has(play.id)) continue;
    seen.add(play.id);
    if (samePick(source, play)) exact.push(play);
    else if (relatedPick(source, play)) related.push(play);
  }
  return {
    exact: [source, ...exact.sort(byCapperThenId)],
    related: related.sort(byCapperThenId),
  };
}

/** Only a void may be applied to a pick at a different line or side. */
export function outcomeAllowedForMatch(
  outcome: CorrectionOutcome,
  match: CandidateMatch,
): boolean {
  return match === "exact" || outcome === "VOID";
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

export type Settlement = { outcome: Outcome; profitUnits: number | null };

export type PlannedStraight = {
  playId: string;
  capperId: string;
  capperLabel: string;
  selection: string;
  before: Settlement;
  after: Settlement;
  changed: boolean;
};

export type PlannedParlay = {
  parlayId: string;
  capperId: string;
  capperLabel: string;
  legCount: number;
  /** Legs whose outcome this correction changes. */
  legChanges: {
    playId: string;
    selection: string;
    before: Outcome;
    after: Outcome;
  }[];
  before: Settlement;
  after: Settlement;
  effectiveOddsAmerican: number | null;
  /** True when any leg changes; the ticket is then re-settled and audited. */
  changed: boolean;
};

export type CorrectionPlan = {
  outcome: CorrectionOutcome;
  straights: PlannedStraight[];
  parlays: PlannedParlay[];
  /** Plays (straights + legs) whose stored outcome or profit changes. */
  changedPlayCount: number;
  /** Selected plays already at the requested result. */
  unchangedPlayCount: number;
  /** Distinct cappers whose record moves. */
  affectedCapperCount: number;
  /** Net change in units across every affected position of record. */
  profitDelta: number;
};

function settlementChanged(before: Settlement, after: Settlement): boolean {
  return (
    before.outcome !== after.outcome ||
    !profitUnitsEqual(before.profitUnits, after.profitUnits)
  );
}

/**
 * What applying `outcome` to `targets` does — per straight bet and per ticket.
 *
 * Straight profit is `profitUnitsForOutcome` on the play's own odds and stake,
 * exactly as the single-play admin action computes it. A leg never carries
 * profit of its own: its ticket is re-settled from every leg with
 * `settleParlay`, so a voided leg drops out and the remaining legs recombine.
 */
export function planCorrection(
  outcome: CorrectionOutcome,
  targets: readonly CorrectionPlay[],
): CorrectionPlan {
  const straights: PlannedStraight[] = [];
  const legsByParlay = new Map<string, CorrectionPlay[]>();
  const seen = new Set<string>();

  for (const play of targets) {
    if (seen.has(play.id)) continue;
    seen.add(play.id);
    if (play.parlay) {
      const legs = legsByParlay.get(play.parlay.id) ?? [];
      legs.push(play);
      legsByParlay.set(play.parlay.id, legs);
      continue;
    }
    const before = { outcome: play.outcome, profitUnits: play.profitUnits };
    const after = {
      outcome,
      profitUnits: profitUnitsForOutcome(
        outcome,
        play.oddsAmerican,
        play.units,
      ),
    };
    straights.push({
      playId: play.id,
      capperId: play.capperId,
      capperLabel: play.capperLabel,
      selection: play.selection,
      before,
      after,
      changed: settlementChanged(before, after),
    });
  }

  const parlays: PlannedParlay[] = [];
  for (const [parlayId, targetedLegs] of legsByParlay) {
    const ticket = targetedLegs[0]!.parlay!;
    const targetedIds = new Set(targetedLegs.map((leg) => leg.id));
    const settlement = settleParlay(
      ticket.legs.map((leg) => ({
        outcome: targetedIds.has(leg.id) ? outcome : leg.outcome,
        oddsAmerican: leg.oddsAmerican,
      })),
      ticket.units,
    );
    const legChanges = targetedLegs
      .filter((leg) => leg.outcome !== outcome)
      .map((leg) => ({
        playId: leg.id,
        selection: leg.selection,
        before: leg.outcome,
        after: outcome,
      }));
    parlays.push({
      parlayId,
      capperId: targetedLegs[0]!.capperId,
      capperLabel: targetedLegs[0]!.capperLabel,
      legCount: ticket.legs.length,
      legChanges,
      before: { outcome: ticket.outcome, profitUnits: ticket.profitUnits },
      after: {
        outcome: settlement.outcome,
        profitUnits: settlement.profitUnits,
      },
      effectiveOddsAmerican: settlement.effectiveOddsAmerican,
      changed: legChanges.length > 0,
    });
  }

  const changedStraights = straights.filter((s) => s.changed);
  const changedLegs = parlays.reduce((n, p) => n + p.legChanges.length, 0);
  const changedPlayCount = changedStraights.length + changedLegs;
  const affectedCappers = new Set([
    ...changedStraights.map((s) => s.capperId),
    ...parlays.filter((p) => p.changed).map((p) => p.capperId),
  ]);
  const profitDelta = round2(
    [...straights, ...parlays]
      .filter((entry) => entry.changed)
      .reduce(
        (sum, entry) =>
          sum +
          (entry.after.profitUnits ?? 0) -
          (entry.before.profitUnits ?? 0),
        0,
      ),
  );

  return {
    outcome,
    straights,
    parlays,
    changedPlayCount,
    unchangedPlayCount: seen.size - changedPlayCount,
    affectedCapperCount: affectedCappers.size,
    profitDelta,
  };
}
