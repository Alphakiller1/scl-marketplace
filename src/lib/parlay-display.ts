import { matchupLabel } from "@/lib/pick-identity";
import { isVerifiedTier, type VerificationTier } from "@/lib/verification";

/**
 * How a parlay presents itself on a public surface.
 *
 * A parlay is one position of record with several legs, so every surface that
 * lists positions — the profile Pick History, the public picks ledger, the
 * home tickers — has to answer the same questions: what is it called, which
 * game(s) is it on, which sport tag does it wear, and is it board-verified?
 * Answering them in one place is what keeps a parlay reading the same way
 * everywhere instead of each surface inventing its own label.
 */

/**
 * A parlay carried on a public position card: one combined price and the legs
 * behind it. Surfaces render the position, never the legs as positions.
 */
export type ParlayPositionDetail = {
  combinedOddsAmerican: number | null;
  legs: {
    id: string;
    sport: string;
    market: string;
    selection: string;
    oddsAmerican: number;
    side: string | null;
    book: string | null;
    /** Matchup line for this leg, when the fixture was recorded. */
    event: string | null;
  }[];
};

export type ParlayLegLike = {
  sport: string;
  eventLabel?: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
};

/** "3-Leg Parlay" — the position's name on every public list. */
export function parlayTitle(legCount: number): string {
  return `${legCount}-Leg Parlay`;
}

/**
 * The fixture line: the shared matchup when every leg is on one game,
 * otherwise a plain count. Never invents a game a leg does not name.
 */
export function parlayGameLabel(legs: ParlayLegLike[]): string | null {
  const games = [
    ...new Set(
      legs
        .map((leg) => matchupLabel(leg))
        .filter((label): label is string => Boolean(label)),
    ),
  ];
  if (games.length === 1) return games[0]!;
  if (games.length > 1) return `${games.length} games`;
  return null;
}

/**
 * The sport tag a parlay wears: its only sport when the legs agree, else the
 * first leg's. A cross-sport parlay still surfaces under each of its sports in
 * a sport-filtered query — the tag is a label, not the filter.
 */
export function parlayDisplaySport(legs: { sport: string }[]): string {
  const sports = [...new Set(legs.map((leg) => leg.sport))];
  return sports.length === 1 ? sports[0]! : (legs[0]?.sport ?? "MULTI");
}

/** Distinct books across the legs — one book, "Mixed Books", or none. */
export function parlayBooks(legs: { book?: string | null }[]): string[] {
  return [
    ...new Set(
      legs
        .map((leg) => leg.book)
        .filter((book): book is string => Boolean(book)),
    ),
  ];
}

/** The single book label for a parlay receipt, or null when no leg names one. */
export function parlayBookLabel(
  legs: { book?: string | null }[],
): string | null {
  const books = parlayBooks(legs);
  if (books.length === 1) return books[0]!;
  return books.length > 1 ? "Mixed Books" : null;
}

/** Earliest leg start (or null) — a parlay's lifecycle anchors to its first game. */
export function earliestLegStart(
  legs: { eventStartsAt?: Date | null }[],
): Date | null {
  const starts = legs
    .map((leg) => leg.eventStartsAt)
    .filter((value): value is Date => value != null);
  if (starts.length === 0) return null;
  return starts.reduce((a, b) => (a.getTime() <= b.getTime() ? a : b));
}

/**
 * Verified only when every leg cleared the board check — one self-reported leg
 * makes the whole ticket self-reported, because the parlay only pays if all of
 * them land.
 */
export function parlayVerificationTier(
  legs: { verificationTier: VerificationTier }[],
): VerificationTier {
  return legs.length > 0 &&
    legs.every((leg) => isVerifiedTier(leg.verificationTier))
    ? "VERIFIED"
    : "SELF_REPORTED";
}
