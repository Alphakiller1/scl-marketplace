import assert from "node:assert/strict";
import { test } from "node:test";

import {
  categoryCounts,
  eventMatchesSearch,
  filterGamePickerEvents,
  selectionForActiveBook,
} from "@/lib/game-picker";
import type { OddsSelection } from "@/lib/odds-board";
import { localDateKey } from "@/lib/slate";

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
  const now = new Date();
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

  const tomorrow = filterGamePickerEvents(EVENTS, {
    day: "tomorrow",
    category: "all",
    search: "",
    now,
  });
  assert.equal(tomorrow.length, 1);
  assert.equal(tomorrow[0]!.id, "3");
});

test("categoryCounts totals near-term slate", () => {
  const now = new Date();
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
  };
  assert.deepEqual(selectionForActiveBook(sel, null), {
    oddsAmerican: -105,
    book: "fanduel",
  });
  assert.deepEqual(selectionForActiveBook(sel, "draftkings"), {
    oddsAmerican: -110,
    book: "draftkings",
  });
  assert.deepEqual(selectionForActiveBook(sel, "betmgm"), {
    oddsAmerican: null,
    book: "betmgm",
  });
});
