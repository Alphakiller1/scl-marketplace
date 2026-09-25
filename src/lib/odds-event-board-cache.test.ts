import assert from "node:assert/strict";
import test from "node:test";

import type { OddsSelection } from "@/lib/odds-board";
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
  const merged = mergeEventBoardSelections([selection, prop], [refreshed]);
  const f5 = merged.find((row) => row.market === selection.market);
  assert.equal(f5?.oddsAmerican, -105);
  assert.equal(f5?.book, "fanduel");
  assert.equal(f5?.bookPrices?.fanduel, -105);
  assert.equal(f5?.bookPrices?.draftkings, -110);
  assert.ok(merged.some((row) => row.market === prop.market));
});

test("merge unions DraftKings surface extras onto FanDuel alt rows", () => {
  const surface = {
    label: "Dodgers +1.5",
    market: "Spread",
    selection: "Dodgers +1.5",
    side: "Dodgers",
    line: 1.5,
    featured: true,
    oddsAmerican: -105,
    book: "draftkings",
    bookPrices: { draftkings: -105 },
  };
  const featured = {
    label: "Los Angeles Dodgers -1.5",
    market: "Spread",
    selection: "Los Angeles Dodgers -1.5",
    side: "Los Angeles Dodgers",
    line: -1.5,
    featured: true,
    oddsAmerican: -110,
    book: "fanduel",
    bookPrices: { fanduel: -110, draftkings: -115 },
  };
  const expanded = {
    label: "Los Angeles Dodgers +1.5",
    market: "Spread",
    selection: "Los Angeles Dodgers +1.5",
    side: "Los Angeles Dodgers",
    line: 1.5,
    featured: false,
    oddsAmerican: -102,
    book: "fanduel",
    bookPrices: { fanduel: -102 },
  };
  const merged = mergeEventBoardSelections(
    [featured, surface],
    [expanded],
    "MLB",
  );
  const alt = merged.find((row) => row.line === 1.5);
  assert.equal(alt?.featured, false);
  assert.equal(alt?.bookPrices?.draftkings, -105);
  assert.equal(alt?.bookPrices?.fanduel, -102);
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

test("a DK companion top-up adds DraftKings to rungs FanDuel already priced", () => {
  const spread = (
    selection: string,
    line: number,
    bookPrices: Record<string, number>,
    featured = false,
  ): OddsSelection => ({
    label: selection,
    market: "Spread",
    selection,
    side: selection.replace(/ [-+][\d.]+$/, ""),
    line,
    featured,
    oddsAmerican: Object.values(bookPrices)[0]!,
    book: Object.keys(bookPrices)[0]!,
    bookPrices,
  });
  const cached = [
    spread(
      "Pittsburgh Pirates -1.5",
      -1.5,
      { fanduel: 160, draftkings: 158 },
      true,
    ),
    spread("Pittsburgh Pirates -2.5", -2.5, { fanduel: 250 }),
  ];
  const fresh = [
    spread("Pittsburgh Pirates -2.5", -2.5, { draftkings: 240, fanduel: 999 }),
    // DK files alt run lines on the featured key, so they arrive featured.
    spread("Pittsburgh Pirates -1", -1, { draftkings: 120 }, true),
  ];
  const merged = addMissingEventBoardSelections(cached, fresh);
  const minus25 = merged.find((row) => row.line === -2.5);
  assert.deepEqual(minus25?.bookPrices, { fanduel: 250, draftkings: 240 });
  assert.equal(minus25?.oddsAmerican, 250, "no existing price moves");
  const minus1 = merged.find((row) => row.line === -1);
  assert.equal(minus1?.featured, false, "a DK rung is not a second main line");
  assert.equal(merged.find((row) => row.line === -1.5)?.featured, true);
});

test("a top-up that finds nothing returns the board unchanged", () => {
  const cached = [teamTotal("Los Angeles Dodgers", 5.5, -110, "fanduel")];
  assert.deepEqual(addMissingEventBoardSelections(cached, []), cached);
});
