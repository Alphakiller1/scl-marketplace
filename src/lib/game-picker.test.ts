import assert from "node:assert/strict";
import { test } from "node:test";

import { PICK_BOARD_BOOKS } from "@/lib/books";
import {
  categoryCounts,
  eventMatchesSearch,
  filterGamePickerEvents,
  isPreGame,
  preGameEvents,
  railBooks,
  selectionForActiveBook,
} from "@/lib/game-picker";
import type { OddsSelection } from "@/lib/odds-board";
import { localDateKey } from "@/lib/slate";

/**
 * Deterministic clock for the slate fixtures. The fixtures are 19:00 local, and
 * the board now excludes started games — so using the real `new Date()` made
 * these tests fail after 7pm. Pin "now" to the morning of the same day.
 */
function localMorning(): Date {
  const d = new Date();
  d.setHours(8, 0, 0, 0);
  return d;
}

function atLocalHour(daysFromNow: number, hour = 19): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

const EVENTS = [
  {
    id: "1",
    sport: "NBA",
    commenceTime: atLocalHour(0),
    home: "Boston Celtics",
    away: "Los Angeles Lakers",
  },
  {
    id: "2",
    sport: "MLB",
    commenceTime: atLocalHour(0),
    home: "New York Yankees",
    away: "Boston Red Sox",
  },
  {
    id: "3",
    sport: "NBA",
    commenceTime: atLocalHour(1),
    home: "Miami Heat",
    away: "Chicago Bulls",
  },
];

test("eventMatchesSearch matches teams, sport, and matchup text", () => {
  assert.equal(eventMatchesSearch(EVENTS[0]!, "lakers"), true);
  assert.equal(eventMatchesSearch(EVENTS[0]!, "NBA"), true);
  assert.equal(eventMatchesSearch(EVENTS[0]!, "lakers @ boston"), true);
  assert.equal(eventMatchesSearch(EVENTS[0]!, "yankees"), false);
  assert.equal(eventMatchesSearch(EVENTS[0]!, "  "), true);
});

test("filterGamePickerEvents applies day + category + search", () => {
  const now = localMorning();
  const todayNba = filterGamePickerEvents(EVENTS, {
    day: "today",
    category: "NBA",
    search: "",
    now,
  });
  assert.equal(todayNba.length, 1);
  assert.equal(todayNba[0]!.id, "1");

  const allToday = filterGamePickerEvents(EVENTS, {
    day: "today",
    category: "all",
    search: "boston",
    now,
  });
  assert.equal(allToday.length, 2);

  const upcoming = filterGamePickerEvents(EVENTS, {
    day: "upcoming",
    category: "all",
    search: "",
    now,
  });
  assert.equal(upcoming.length, 1);
  assert.equal(upcoming[0]!.id, "3");
});

test("categoryCounts totals near-term slate", () => {
  const now = localMorning();
  const { all, bySport } = categoryCounts(EVENTS, now);
  assert.equal(all, 3);
  assert.equal(bySport.NBA, 2);
  assert.equal(bySport.MLB, 1);
  // sanity: today key matches helper
  assert.ok(localDateKey(now).length > 0);
});

test("selectionForActiveBook is honest null (no silent substitute)", () => {
  const sel: OddsSelection = {
    label: "Lakers ML",
    market: "Moneyline",
    selection: "Lakers",
    side: "Lakers",
    featured: true,
    oddsAmerican: -105,
    book: "fanduel",
    bookPrices: { fanduel: -105, draftkings: -110 },
    bookCapturedAt: {
      fanduel: "2026-07-18T18:00:00Z",
      draftkings: "2026-07-18T17:55:00Z",
    },
    oddsCapturedAt: "2026-07-18T18:00:00Z",
  };
  assert.deepEqual(selectionForActiveBook(sel, null), {
    oddsAmerican: -105,
    book: "fanduel",
    oddsCapturedAt: "2026-07-18T18:00:00Z",
  });
  assert.deepEqual(selectionForActiveBook(sel, "draftkings"), {
    oddsAmerican: -110,
    book: "draftkings",
    oddsCapturedAt: "2026-07-18T17:55:00Z",
  });
  assert.deepEqual(selectionForActiveBook(sel, "betmgm"), {
    oddsAmerican: null,
    book: "betmgm",
  });
});

test("started games are never selectable on the board", () => {
  const now = new Date("2026-07-29T20:00:00Z");
  const started = {
    id: "started",
    sport: "MLB",
    commenceTime: "2026-07-29T19:00:00Z", // 1h ago
    home: "Dodgers",
    away: "Padres",
  };
  const upcoming = {
    id: "upcoming",
    sport: "MLB",
    commenceTime: "2026-07-29T23:00:00Z", // 3h out
    home: "Yankees",
    away: "Orioles",
  };
  const unparseable = {
    id: "bad",
    sport: "MLB",
    commenceTime: "not-a-date",
    home: "Cubs",
    away: "Reds",
  };

  assert.equal(isPreGame(started, now), false);
  assert.equal(isPreGame(upcoming, now), true);
  // Can't prove it's pre-game → must not be offered.
  assert.equal(isPreGame(unparseable, now), false);

  assert.deepEqual(
    preGameEvents([started, upcoming, unparseable], now).map((e) => e.id),
    ["upcoming"],
  );

  // A game that started must not survive the board filter, even when its
  // day/category/search all match.
  const visible = filterGamePickerEvents([started, upcoming], {
    day: "today",
    category: "MLB",
    search: "",
    now,
  });
  assert.ok(
    !visible.some((e) => e.id === "started"),
    "started game leaked onto the board",
  );

  // Counts must not advertise started games as pre-game.
  assert.equal(categoryCounts([started], now).all, 0);
});

test("the pick-form rail is the owner five, not every supported book", () => {
  assert.deepEqual(railBooks(), [...PICK_BOARD_BOOKS]);
  assert.ok(!railBooks().includes("bovada"));
  assert.ok(!railBooks().includes("espnbet"));
});

test("best-available shows a price where a single book has none", () => {
  const selection: OddsSelection = {
    label: "Reds ML",
    market: "Moneyline",
    selection: "Reds",
    side: "Reds",
    oddsAmerican: -120,
    book: "fanduel",
    bookPrices: { fanduel: -120 },
  };
  // Pinned to a book with no line: honest null (chip renders "—").
  assert.equal(selectionForActiveBook(selection, "betmgm").oddsAmerican, null);
  // Best-available: a real number, which is why it is the default.
  assert.equal(selectionForActiveBook(selection, null).oddsAmerican, -120);
  assert.equal(selectionForActiveBook(selection, null).book, "fanduel");
});

test("best-available ignores books outside the pick-form five", () => {
  const selection: OddsSelection = {
    label: "Reds ML",
    market: "Moneyline",
    selection: "Reds",
    side: "Reds",
    oddsAmerican: 150,
    book: "bovada",
    bookPrices: { bovada: 150, draftkings: -110, fanduel: -105 },
  };
  const best = selectionForActiveBook(selection, null);
  assert.equal(best.oddsAmerican, -105);
  assert.equal(best.book, "fanduel");
});

test("tennis Best falls back to Bovada when the five have no game line", () => {
  const selection: OddsSelection = {
    label: "Ann Li -3.5",
    market: "Spread",
    selection: "Ann Li -3.5",
    side: "Ann Li",
    line: -3.5,
    oddsAmerican: -110,
    book: "bovada",
    bookPrices: { bovada: -110 },
  };
  const hidden = selectionForActiveBook(selection, null, "MLB");
  assert.equal(hidden.oddsAmerican, null);
  const tennis = selectionForActiveBook(selection, null, "TENNIS");
  assert.equal(tennis.oddsAmerican, -110);
  assert.equal(tennis.book, "bovada");
  const fanduelTab = selectionForActiveBook(selection, "fanduel", "TENNIS");
  assert.equal(fanduelTab.oddsAmerican, null);
});
