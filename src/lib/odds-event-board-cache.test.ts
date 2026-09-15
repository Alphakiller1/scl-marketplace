import assert from "node:assert/strict";
import test from "node:test";

import {
  addMissingEventBoardSelections,
  mergeEventBoardSelections,
  parseEventBoardSnapshot,
} from "@/lib/odds-event-board-contract";

const selection = {
  label: "Away +1.5 (F5 Spread)",
  market: "1st 5 Innings Spread",
  selection: "Away +1.5 (F5 Spread)",
  side: "Away",
  line: 1.5,
  oddsAmerican: -105,
  book: "fanduel",
};

test("accepts a populated last-good event board for the exact event", () => {
  const snapshot = {
    version: 1,
    sport: "MLB",
    eventId: "event-1",
    selections: [selection],
    savedAt: Date.now(),
  };
  // A snapshot written before the daily buy cap shipped has no buy log. It must
  // still parse — rejecting it would throw away a cached board that cost real
  // credits — and it reads as an untouched allowance.
  assert.deepEqual(parseEventBoardSnapshot(snapshot, "MLB", "event-1"), {
    ...snapshot,
    buys: [],
    topUps: [],
  });
});

test("the buy log round-trips, and junk entries are dropped", () => {
  const now = Date.now();
  const parsed = parseEventBoardSnapshot(
    {
      version: 1,
      sport: "MLB",
      eventId: "event-1",
      selections: [selection],
      savedAt: now,
      buys: [now - 3_600_000, "not-a-time", null, Number.NaN, now],
    },
    "MLB",
    "event-1",
  );
  assert.deepEqual(parsed?.buys, [now - 3_600_000, now]);
});

test("rejects empty, malformed, or cross-event snapshots", () => {
  const base = {
    version: 1,
    sport: "MLB",
    eventId: "event-1",
    selections: [selection],
    savedAt: Date.now(),
  };
  assert.equal(
    parseEventBoardSnapshot({ ...base, selections: [] }, "MLB", "event-1"),
    null,
  );
  assert.equal(parseEventBoardSnapshot(base, "MLB", "event-2"), null);
  assert.equal(
    parseEventBoardSnapshot(
      { ...base, selections: [{ market: "Spread" }] },
      "MLB",
      "event-1",
    ),
    null,
  );
});

test("partial refresh retains missing last-good market groups", () => {
  const prop = {
    ...selection,
    label: "Pitcher Over 6.5",
    market: "Strikeouts",
    selection: "Pitcher Over 6.5",
    side: "Over",
    line: 6.5,
    player: "Pitcher",
  };
  const refreshed = { ...selection, oddsAmerican: -110, book: "draftkings" };
  assert.deepEqual(mergeEventBoardSelections([selection, prop], [refreshed]), [
    refreshed,
    prop,
  ]);
});

test("merge keeps same-line team totals for both clubs", () => {
  const yankees = {
    ...selection,
    market: "Team Total",
    label: "Yankees Over 4.5",
    selection: "Yankees Over 4.5",
    side: "Over",
    line: 4.5,
  };
  const redSox = {
    ...yankees,
    label: "Red Sox Over 4.5",
    selection: "Red Sox Over 4.5",
  };
  assert.deepEqual(mergeEventBoardSelections([yankees], [redSox]), [
    yankees,
    redSox,
  ]);
});

test("the top-up log round-trips apart from the buy log", () => {
  const now = Date.now();
  const parsed = parseEventBoardSnapshot(
    {
      version: 1,
      sport: "MLB",
      eventId: "event-1",
      selections: [selection],
      savedAt: now,
      buys: [now - 7_200_000],
      topUps: [now - 3_600_000, "junk", now],
    },
    "MLB",
    "event-1",
  );
  assert.deepEqual(parsed?.buys, [now - 7_200_000]);
  assert.deepEqual(parsed?.topUps, [now - 3_600_000, now]);
});

// Phillies at Nationals, 2026-09-15: the board held the featured line per club
// and a top-up brought the Caesars ladder.
function teamTotal(team: string, line: number, price: number, book: string) {
  const text = `${team} Over ${line}`;
  return {
    label: text,
    market: "Team Total",
    selection: text,
    side: "Over",
    line,
    featured: false,
    oddsAmerican: price,
    book,
    bookPrices: { [book]: price },
  };
}

test("a top-up adds missing rungs and leaves every existing price alone", () => {
  const cached = [
    teamTotal("Philadelphia Phillies", 4.5, -113, "fanduel"),
    teamTotal("Washington Nationals", 2.5, 105, "draftkings"),
  ];
  const fresh = [
    // Same line the board already carries, priced by the ladder's book. It must
    // not displace the FanDuel price a capper was already shown.
    teamTotal("Philadelphia Phillies", 4.5, -125, "williamhill_us"),
    teamTotal("Philadelphia Phillies", 2.5, -320, "williamhill_us"),
    teamTotal("Philadelphia Phillies", 3.5, -190, "williamhill_us"),
  ];
  const merged = addMissingEventBoardSelections(cached, fresh);
  assert.equal(merged.length, 4);
  const phillies45 = merged.find(
    (row) => row.selection === "Philadelphia Phillies Over 4.5",
  );
  assert.equal(phillies45?.oddsAmerican, -113);
  assert.equal(phillies45?.book, "fanduel");
  assert.ok(
    merged.some((row) => row.selection === "Philadelphia Phillies Over 2.5"),
    "the rung the owners asked for is on the board",
  );
});

test("a top-up that finds nothing returns the board unchanged", () => {
  const cached = [teamTotal("Los Angeles Dodgers", 5.5, -110, "fanduel")];
  assert.deepEqual(addMissingEventBoardSelections(cached, []), cached);
});
