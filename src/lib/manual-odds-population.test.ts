import assert from "node:assert/strict";
import test from "node:test";

import type { OddsEvent } from "@/lib/odds-board";
import {
  EVENT_MARKET_CATALOG_CREDIT_COST,
  eventMarketCatalogKeys,
  expandedEventCreditCost,
  intersectExpandedMarkets,
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

test("expanded order includes tennis and ignores sports without event markets", () => {
  // NFL is surface-level odds only, so it never joins the expanded pass; soccer
  // does, for Double Chance, and sorts last because it is the sport whose
  // expanded market can be dropped without leaving a fixture unbettable.
  assert.deepEqual(
    parseExpandedSportOrder(null, ["NFL", "WNBA", "MLB", "SOCCER"]),
    ["MLB", "WNBA", "SOCCER"],
  );
  assert.deepEqual(parseExpandedSportOrder("WNBA,MLB", ["MLB", "WNBA"]), [
    "WNBA",
    "MLB",
  ]);
  assert.deepEqual(parseExpandedSportOrder("MLB", ["MLB", "WNBA"]), [
    "MLB",
    "WNBA",
  ]);
  assert.deepEqual(parseExpandedSportOrder(null, ["TENNIS"]), ["TENNIS"]);
  assert.deepEqual(parseExpandedSportOrder("TENNIS,MLB", ["MLB", "TENNIS"]), [
    "TENNIS",
    "MLB",
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

test("event market catalog reads every key any covered book prices", () => {
  const payload = {
    bookmakers: [
      { key: "draftkings", markets: [{ key: "h2h" }, { key: "team_totals" }] },
      {
        key: "fanduel",
        markets: [{ key: "team_totals" }, { key: "batter_walks" }],
      },
      { key: "broken", markets: "not-an-array" },
    ],
  };
  assert.deepEqual(eventMarketCatalogKeys(payload).sort(), [
    "batter_walks",
    "h2h",
    "team_totals",
  ]);
  assert.deepEqual(eventMarketCatalogKeys(null), []);
  assert.deepEqual(eventMarketCatalogKeys({ bookmakers: [] }), []);
});

test("expanded markets drop keys no book is pricing, keeping request order", () => {
  const desired = ["alternate_spreads", "batter_walks", "pitcher_walks"];
  assert.deepEqual(
    intersectExpandedMarkets(desired, [
      "pitcher_walks",
      "h2h",
      "alternate_spreads",
    ]),
    ["alternate_spreads", "pitcher_walks"],
  );
  // A failed catalog lookup must not empty the board — it falls back to asking
  // for everything, which is exactly the old behaviour.
  assert.deepEqual(intersectExpandedMarkets(desired, []), desired);
});

test("the reserve prices an expanded event with its catalog call included", () => {
  // Estimating high is the safe direction: the catalog can only make the real
  // spend smaller, so a reserve built on it never starves the next sport.
  assert.equal(EVENT_MARKET_CATALOG_CREDIT_COST, 1);
  assert.equal(expandedEventCreditCost("MLB") > 40, true);
  assert.equal(expandedEventCreditCost("NFL"), 0);
  assert.equal(expandedEventCreditCost("SOCCER"), 1);
});
