/**
 * Pure GamePicker helpers — searchable multi-sport slate + active-book price view.
 * No React / network — unit-testable.
 */

import { isPickBoardBook, PICK_BOARD_BOOKS } from "@/lib/books";
import {
  getOddsForBook,
  preferredThenAll,
  type OddsSelection,
} from "@/lib/odds-board";
import { filterBySlateDay, nearTermEvents, type SlateDay } from "@/lib/slate";

/** A feed must never leave the pick-entry board spinning indefinitely. */
export const ODDS_BOARD_REQUEST_TIMEOUT_MS = 20_000;

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
  { key: "TENNIS", label: "Tennis" },
  { key: "MMA", label: "MMA / UFC" },
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
 * Drop events that have already started.
 *
 * SCL accepts pre-game picks only. The submit actions reject started events, but
 * the board must never *offer* one — otherwise a capper picks a live game, taps
 * submit, and eats a rejection. This is the single source of that rule for the
 * board, its counts, and its "N pre-game" label.
 */
export function isPreGame(
  event: Pick<GamePickerEvent, "commenceTime">,
  now: Date = new Date(),
): boolean {
  const start = Date.parse(event.commenceTime);
  // Unparseable start time can't be proven pre-game — exclude it.
  if (Number.isNaN(start)) return false;
  return start > now.getTime();
}

export function preGameEvents<T extends GamePickerEvent>(
  events: readonly T[],
  now: Date = new Date(),
): T[] {
  return events.filter((e) => isPreGame(e, now));
}

/**
 * Filter the loaded multi-sport slate by day, category ("all" | sport key), and search.
 * Started events are excluded first — they are never selectable.
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
  const live = preGameEvents(events, opts.now);
  const dayEvents = filterBySlateDay(live, opts.day, opts.now);
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
  // Counts must match what the board will actually show — pre-game only.
  const near = nearTermEvents(preGameEvents(events, now), now);
  return { all: near.length, bySport: countEventsBySport(near) };
}

/**
 * Resolve the displayed American price for a board selection under an active book.
 * Honest null when that book has no line (UI renders "—"; never substitutes).
 * When no active book, Best is the most bettor-favorable price among
 * {@link PICK_BOARD_BOOKS} only — extra US books on the payload are ignored.
 */
export function selectionForActiveBook(
  selection: OddsSelection,
  activeBook: string | null | undefined,
): { oddsAmerican: number | null; book?: string; oddsCapturedAt?: string } {
  if (!activeBook) {
    const byBook = new Map(
      Object.entries(selection.bookPrices ?? {}).filter(
        (entry): entry is [string, number] => typeof entry[1] === "number",
      ),
    );
    const lastUpdateByBook = selection.bookCapturedAt
      ? new Map(
          Object.entries(selection.bookCapturedAt).filter(
            ([, value]) => typeof value === "string",
          ),
        )
      : undefined;
    const best = preferredThenAll(byBook, PICK_BOARD_BOOKS, lastUpdateByBook, {
      fallbackToAll: false,
    });
    if (best) {
      return {
        oddsAmerican: best.price,
        book: best.book,
        ...(best.capturedAt ? { oddsCapturedAt: best.capturedAt } : {}),
      };
    }
    if (selection.book && isPickBoardBook(selection.book)) {
      return {
        oddsAmerican: selection.oddsAmerican,
        book: selection.book,
        ...(selection.oddsCapturedAt
          ? { oddsCapturedAt: selection.oddsCapturedAt }
          : {}),
      };
    }
    return { oddsAmerican: null };
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

/**
 * Sportsbooks to offer in the pick-entry rail.
 *
 * The rail is the owner-fixed five (MGM, Caesars, DraftKings, FanDuel,
 * Fanatics) plus a Best tab computed from that same set. Profile books do not
 * hide tabs — almost every capper has an empty list, and extra US books are
 * out of the pick-form product.
 */
export function railBooks(): string[] {
  return [...PICK_BOARD_BOOKS];
}
