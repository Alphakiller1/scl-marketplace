import type { Outcome } from "@prisma/client";

import { overUnderOutcome } from "@/lib/results/prop-resolve";

/**
 * Settle player props from an ESPN box score.
 *
 * This is the last class of play that could not auto-grade. Everything here is
 * pure so the parsing — the part that actually breaks — is unit-testable; the
 * network call lives in stats-provider.ts.
 *
 * See docs/GRADING_PROPS_STATS_FEED_SPEC.md.
 */

/** One athlete's stat line, already normalised to numbers. */
export type PlayerStatLine = {
  name: string;
  team: string;
  /** Whether the athlete actually appeared. A DNP row carries no stats. */
  played: boolean;
  stats: Record<string, number>;
};

export type PlayerBoxScore = { players: PlayerStatLine[] };

/**
 * SCL market label → the canonical stat key produced by the ESPN mappers.
 *
 * Keys are the labels `PROP_MARKET_LABEL` puts on a play's `market`, because
 * that is what the board writes and therefore what grading reads back.
 */
const MARKET_STAT_KEY: Record<string, string> = {
  points: "points",
  rebounds: "rebounds",
  assists: "assists",
  "3-pointers": "threes",
  strikeouts: "strikeouts",
  outs: "outs",
  "earned runs": "earnedRuns",
  hits: "hits",
};

export function statKeyForMarket(market: string | null): string | null {
  if (!market) return null;
  return MARKET_STAT_KEY[market.trim().toLowerCase()] ?? null;
}

/** Combining diacritical marks, written as escapes so the source stays ASCII. */
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Strip accents, punctuation and suffixes so "Cristopher Sanchez" matches
 * ESPN's spelling, and "Michael Wacha Jr." matches "Michael Wacha".
 */
export function normalizeName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pull the athlete's name off the front of a selection.
 *
 * Board-written selections read "Michael Wacha Over 4.5" / "Sabrina Ionescu
 * Under 19.5" — the name is everything before the Over/Under. Returns null when
 * there is no such marker, because then we cannot tell a name from a team and
 * must not guess.
 */
export function playerNameFromSelection(selection: string): string | null {
  const m = selection.match(/^(.*?)\s+(over|under|o|u)\b/i);
  const name = m?.[1]?.trim();
  if (!name) return null;
  // A single token is not a player name ("Team Total Over 4.5").
  if (normalizeName(name).split(" ").filter(Boolean).length < 2) return null;
  return name;
}

/**
 * Find one athlete by name. Requires a unique match: two players sharing a
 * surname must never be settled by picking the first one found.
 */
export function findPlayer(
  box: PlayerBoxScore,
  name: string,
): PlayerStatLine | null | "AMBIGUOUS" {
  const target = normalizeName(name);
  if (!target) return null;

  const exact = box.players.filter((p) => normalizeName(p.name) === target);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return "AMBIGUOUS";

  // Fall back to surname, which is how books and cappers usually shorten it.
  const surname = target.split(" ").slice(-1)[0];
  const bySurname = box.players.filter(
    (p) => normalizeName(p.name).split(" ").slice(-1)[0] === surname,
  );
  if (bySurname.length === 1) return bySurname[0];
  return bySurname.length > 1 ? "AMBIGUOUS" : null;
}

export type PlayerPropPlay = {
  market: string | null;
  selection: string;
  side?: string | null;
  line?: number | null;
};

function sideFromSelection(selection: string): "over" | "under" | null {
  if (/\bunder\b|\bu\d/i.test(selection)) return "under";
  if (/\bover\b|\bo\d/i.test(selection)) return "over";
  return null;
}

/**
 * Settle one player prop, or return null to defer.
 *
 * Deferring is always preferred to guessing: an unknown market, an unfindable
 * or ambiguous player, or a missing stat all return null so the play stays
 * PENDING for a human rather than being settled wrongly.
 *
 * A player who did not appear returns VOID — the standard book rule, and
 * deterministic enough to automate. That is different from "we could not find
 * him", which defers.
 */
export function resolvePlayerProp(
  play: PlayerPropPlay,
  box: PlayerBoxScore,
): Outcome | null {
  const statKey = statKeyForMarket(play.market);
  if (!statKey) return null;

  const line = typeof play.line === "number" ? play.line : null;
  if (line == null) return null;

  const rawSide = (play.side ?? "").trim().toLowerCase();
  const side =
    rawSide === "over" || rawSide === "o"
      ? "over"
      : rawSide === "under" || rawSide === "u"
        ? "under"
        : sideFromSelection(play.selection);
  if (!side) return null;

  const name = playerNameFromSelection(play.selection);
  if (!name) return null;

  const found = findPlayer(box, name);
  if (found === "AMBIGUOUS" || !found) return null;
  if (!found.played) return "VOID";

  const actual = found.stats[statKey];
  if (typeof actual !== "number" || !Number.isFinite(actual)) return null;

  return overUnderOutcome(actual, line, side);
}
