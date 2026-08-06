import assert from "node:assert/strict";
import { test } from "node:test";

import {
  dedupeOddsEvents,
  sortByKickoff,
  type OddsEvent,
} from "@/lib/odds-board";

/**
 * Regression cover for a live report: "I don't see NFL lines" on a night the
 * Hall of Fame game was playing.
 *
 * The preseason board was fetched correctly and billed correctly — production
 * logged `upcoming americanfootball_nfl_preseason: cost=3` — and was then
 * discarded before reaching the capper. Books post the whole regular season in
 * August, so the regular-season board already returned the full 60-event cap;
 * preseason was appended after it and sliced off the end.
 */

const BOARD_CAP = 60;

function event(id: string, commenceTime: string): OddsEvent {
  return {
    id,
    sport: "NFL",
    commenceTime,
    home: `${id} home`,
    away: `${id} away`,
    selections: [],
  };
}

/** What `fetchUpcomingOdds` does to a merged slate. */
function mergeBoard(board: OddsEvent[], extras: OddsEvent[]): OddsEvent[] {
  return sortByKickoff(dedupeOddsEvents([...board, ...extras])).slice(
    0,
    BOARD_CAP,
  );
}

test("tonight's preseason game survives a full regular-season board", () => {
  // September, already at the cap — exactly what the API returns in August.
  const regularSeason = Array.from({ length: BOARD_CAP }, (_, i) =>
    event(
      `reg-${i}`,
      `2026-09-${String((i % 27) + 1).padStart(2, "0")}T17:00:00Z`,
    ),
  );
  // Tonight.
  const preseason = [
    event("hall-of-fame", "2026-08-06T23:00:00Z"),
    event("pre-2", "2026-08-08T23:00:00Z"),
  ];

  const merged = mergeBoard(regularSeason, preseason);

  assert.equal(merged.length, BOARD_CAP);
  // The two soonest games are the preseason ones, at the top of the board.
  assert.deepEqual(
    merged.slice(0, 2).map((e) => e.id),
    ["hall-of-fame", "pre-2"],
  );

  // The old behaviour — append then cap without sorting — lost them entirely.
  const unsorted = dedupeOddsEvents([...regularSeason, ...preseason]).slice(
    0,
    BOARD_CAP,
  );
  assert.equal(
    unsorted.some((e) => e.id === "hall-of-fame"),
    false,
  );
});

test("kickoff order puts the soonest game first and never drops events", () => {
  const events = [
    event("late", "2026-09-10T17:00:00Z"),
    event("soon", "2026-08-06T23:00:00Z"),
    event("mid", "2026-08-20T17:00:00Z"),
  ];
  assert.deepEqual(
    sortByKickoff(events).map((e) => e.id),
    ["soon", "mid", "late"],
  );
  assert.equal(sortByKickoff(events).length, events.length);
});

test("an unparseable kickoff sorts last instead of scrambling the slate", () => {
  const events = [
    event("broken", "not-a-date"),
    event("late", "2026-09-10T17:00:00Z"),
    event("soon", "2026-08-06T23:00:00Z"),
  ];
  assert.deepEqual(
    sortByKickoff(events).map((e) => e.id),
    ["soon", "late", "broken"],
  );
});
