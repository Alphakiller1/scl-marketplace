import assert from "node:assert/strict";
import test from "node:test";

import type { OddsEvent } from "@/lib/odds-board";
import {
  expandedEventCreditCost,
  laterExpandedCreditReserve,
  mergeLastGoodBoardEvents,
  parseExpandedSlateDays,
  parseExpandedSportOrder,
  selectExpandedSlateEvents,
  shouldHoldCreditsForLater,
} from "@/lib/manual-odds-population";

const NOW = new Date("2026-08-18T06:00:00.000Z");

function event(id: string, commenceTime: string): OddsEvent {
  return {
    id,
    sport: "MLB",
    commenceTime,
    home: `${id} home`,
    away: `${id} away`,
    selections: [
      {
        label: `${id} home`,
        market: "Moneyline",
        selection: `${id} home`,
        side: `${id} home`,
        featured: true,
        oddsAmerican: -110,
        book: "draftkings",
      },
    ],
  };
}

test("expanded warming can target tomorrow without spending on later games", () => {
  const rows = [
    event("today", "2026-08-18T23:00:00.000Z"),
    event("tomorrow", "2026-08-19T23:00:00.000Z"),
    event("later", "2026-08-20T23:00:00.000Z"),
  ];
  assert.deepEqual(
    selectExpandedSlateEvents(rows, ["tomorrow"], NOW).map((row) => row.id),
    ["tomorrow"],
  );
});

test("expanded day input accepts only the supported ET windows", () => {
  assert.deepEqual(
    parseExpandedSlateDays(" tomorrow, today, tomorrow,weekend "),
    ["tomorrow", "today"],
  );
});

test("a partial refresh retains future last-good fixtures", () => {
  const fresh = [event("fresh", "2026-08-19T23:00:00.000Z")];
  const prior = [
    event("fresh", "2026-08-19T22:00:00.000Z"),
    event("retained", "2026-08-19T21:00:00.000Z"),
    event("started", "2026-08-18T05:00:00.000Z"),
  ];
  const merged = mergeLastGoodBoardEvents(fresh, prior, NOW);
  assert.deepEqual(
    merged.map((row) => row.id),
    ["retained", "fresh"],
  );
  assert.equal(
    merged.find((row) => row.id === "fresh")?.commenceTime,
    fresh[0]?.commenceTime,
  );
});

test("expanded order defaults to MLB then WNBA and ignores other sports", () => {
  assert.deepEqual(
    parseExpandedSportOrder(null, ["NFL", "WNBA", "MLB", "SOCCER"]),
    ["MLB", "WNBA"],
  );
  assert.deepEqual(parseExpandedSportOrder("WNBA,MLB", ["MLB", "WNBA"]), [
    "WNBA",
    "MLB",
  ]);
  assert.deepEqual(parseExpandedSportOrder("MLB", ["MLB", "WNBA"]), [
    "MLB",
    "WNBA",
  ]);
});

test("a short key holds MLB credits so today's WNBA expanded board still fits", () => {
  const wnbaCost = expandedEventCreditCost("WNBA");
  const mlbCost = expandedEventCreditCost("MLB");
  assert.ok(mlbCost > 0);
  assert.ok(wnbaCost > 0);
  const later = laterExpandedCreditReserve([{ sport: "WNBA", events: 2 }]);
  assert.equal(later, wnbaCost * 2);
  assert.equal(shouldHoldCreditsForLater(100, mlbCost, later, 25), true);
  assert.equal(shouldHoldCreditsForLater(400, mlbCost, later, 25), false);
  assert.equal(shouldHoldCreditsForLater(null, mlbCost, later, 25), false);
  assert.equal(shouldHoldCreditsForLater(40, mlbCost, 0, 25), false);
});
