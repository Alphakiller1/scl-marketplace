/**
 * Pure GamePicker helpers — searchable multi-sport slate + active-book price view.
 * No React / network — unit-testable.
 */

import { getOddsForBook, type OddsSelection } from "@/lib/odds-board";
import { filterBySlateDay, nearTermEvents, type SlateDay } from "@/lib/slate";

/** Sports The Odds API board can serve (client-safe mirror of odds-api SCL_TO_ODDS_API keys). */
export const ODDS_BOARD_SPORTS = [
  { key: "NFL", label: "NFL" },
  { key: "NBA", label: "NBA" },
  { key: "NCAAF", label: "NCAAF" },
  { key: "NCAAB", label: "NCAAB" },
  { key: "MLB", label: "MLB" },
  { key: "NHL", label: "NHL" },
  { key: "WNBA", label: "WNBA" },
  { key: "CFL", label: "CFL" },
  { key: "SOCCER", label: "Soccer" },
] as const;

export type OddsBoardSportKey = (typeof ODDS_BOARD_SPORTS)[number]["key"];

export type GamePickerEvent = {
  id: string;
  sport: string;
  league?: string;
  commenceTime: string;
  home: string;
  away: string;
};

/** Case-insensitive match on teams, sport/league key, or "away @ home". */
export function eventMatchesSearch(
  event: GamePickerEvent,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    event.away,
    event.home,
    event.sport,
    `${event.away} @ ${event.home}`,
    `${event.away} at ${event.home}`,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function countEventsBySport(
  events: readonly GamePickerEvent[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of events) {
    counts[e.sport] = (counts[e.sport] ?? 0) + 1;
  }
  return counts;
}

/**
 * Filter the loaded multi-sport slate by day, category ("all" | sport key), and search.
 */
export function filterGamePickerEvents<T extends GamePickerEvent>(
  events: readonly T[],
  opts: {
    day: SlateDay;
    category: string; // "all" or sport key
    search: string;
    now?: Date;
  },
): T[] {
  const dayEvents = filterBySlateDay(events, opts.day, opts.now);
  const byCategory =
    opts.category === "all" || !opts.category
      ? dayEvents
      : dayEvents.filter((e) => e.sport === opts.category);
  return byCategory.filter((e) => eventMatchesSearch(e, opts.search));
}

/** Near-term (today+tomorrow) events used for category pill counts. */
export function categoryCounts(
  events: readonly GamePickerEvent[],
  now = new Date(),
): { all: number; bySport: Record<string, number> } {
  const near = nearTermEvents(events, now);
  return { all: near.length, bySport: countEventsBySport(near) };
}

/**
 * Resolve the displayed American price for a board selection under an active book.
 * Honest null when that book has no line (UI renders "—"; never substitutes).
 * When no active book, keep the selection's best-attributed price.
 */
export function selectionForActiveBook(
  selection: OddsSelection,
  activeBook: string | null | undefined,
): { oddsAmerican: number | null; book?: string; oddsCapturedAt?: string } {
  if (!activeBook) {
    return {
      oddsAmerican: selection.oddsAmerican,
      book: selection.book,
      ...(selection.oddsCapturedAt
        ? { oddsCapturedAt: selection.oddsCapturedAt }
        : {}),
    };
  }
  const price = getOddsForBook(selection, activeBook);
  if (price === null) {
    return { oddsAmerican: null, book: activeBook };
  }
  const oddsCapturedAt =
    selection.bookCapturedAt?.[activeBook] ??
    (selection.book === activeBook ? selection.oddsCapturedAt : undefined);
  return {
    oddsAmerican: price,
    book: activeBook,
    ...(oddsCapturedAt ? { oddsCapturedAt } : {}),
  };
}
