import assert from "node:assert/strict";
import test from "node:test";

import {
  isPeriodMarket,
  parsePeriodMarket,
  periodMarketKey,
  periodMarketKeysForLabel,
  periodMarketKeysForSport,
  periodMarketLabel,
  segmentShortLabel,
} from "@/lib/period-markets";
import { marketKeysForMarket, verificationMarkets } from "@/lib/odds-verify";

test("period market keys match the Odds API naming", () => {
  assert.equal(periodMarketKey(5, "moneyline"), "h2h_1st_5_innings");
  assert.equal(periodMarketKey(3, "spread"), "spreads_1st_3_innings");
  assert.equal(periodMarketKey(7, "total"), "totals_1st_7_innings");
});

test("MLB requests F3/F5/F7 across all three kinds; other sports request none", () => {
  const mlb = verificationMarkets("MLB");
  for (const innings of [3, 5, 7]) {
    for (const kind of ["moneyline", "spread", "total"] as const) {
      assert.ok(
        mlb.includes(periodMarketKey(innings as 3 | 5 | 7, kind)),
        `MLB should request ${periodMarketKey(innings as 3 | 5 | 7, kind)}`,
      );
    }
  }
  // Full-game markets are still there — period markets are additive.
  assert.ok(mlb.includes("h2h") && mlb.includes("alternate_totals"));
  // Clock sports get halves instead of innings, never both.
  assert.ok(!verificationMarkets("NBA").some((m) => m.includes("_innings")));
  assert.deepEqual(periodMarketKeysForSport("NBA"), [
    "h2h_h1",
    "spreads_h1",
    "totals_h1",
    "h2h_h2",
    "spreads_h2",
    "totals_h2",
  ]);
  // Hockey has periods, not halves — it gets neither.
  assert.deepEqual(periodMarketKeysForSport("NHL"), []);
});

test("stored labels round-trip back to their market key", () => {
  const label = periodMarketLabel(5, "moneyline");
  assert.equal(label, "1st 5 Innings Moneyline");
  assert.deepEqual(periodMarketKeysForLabel(label), ["h2h_1st_5_innings"]);
  assert.deepEqual(marketKeysForMarket(label), ["h2h_1st_5_innings"]);
  assert.deepEqual(marketKeysForMarket(periodMarketLabel(3, "total")), [
    "totals_1st_3_innings",
  ]);
});

test("period markets do not collide with the full-game market mapping", () => {
  assert.deepEqual(marketKeysForMarket("Moneyline"), ["h2h"]);
  assert.deepEqual(marketKeysForMarket("Total"), [
    "totals",
    "alternate_totals",
  ]);
  assert.equal(parsePeriodMarket("Moneyline"), null);
  assert.equal(parsePeriodMarket("Total"), null);
  assert.equal(parsePeriodMarket("Strikeouts"), null);
  assert.equal(isPeriodMarket("Spread"), false);
});

test("parsePeriodMarket also recognizes the shapes legacy imports produced", () => {
  // These carried over from the old platform and must not be mistaken for
  // full-game markets by the grader.
  assert.deepEqual(parsePeriodMarket("First Five Innings"), {
    innings: 5,
    kind: null,
  });
  assert.deepEqual(parsePeriodMarket("F5 ML"), {
    innings: 5,
    kind: "moneyline",
  });
  assert.deepEqual(parsePeriodMarket("1st 3 Innings Run Line"), {
    innings: 3,
    kind: "spread",
  });
  assert.equal(isPeriodMarket("First Five Innings"), true);
});

test("CFL and the other clock sports offer half lines", () => {
  const cfl = periodMarketKeysForSport("CFL");
  assert.ok(cfl.includes("h2h_h1") && cfl.includes("totals_h2"));
  assert.ok(verificationMarkets("CFL").includes("spreads_h1"));

  // Halves are recognised as partial-game markets, so they can never be
  // settled on a full-game score — but they carry no innings count.
  assert.deepEqual(parsePeriodMarket("1st Half Moneyline"), {
    innings: 0,
    kind: "moneyline",
  });
  assert.equal(isPeriodMarket("2nd Half Total"), true);
  // Full-game markets stay untouched.
  assert.equal(parsePeriodMarket("Moneyline"), null);
});

test("half lines get a half label, not F0", () => {
  // periodMarketShortLabel takes an innings count, and a half has none — so
  // passing its 0 through rendered every CFL half chip as "F0 ML".
  assert.equal(segmentShortLabel("1st Half Moneyline"), "H1 ML");
  assert.equal(segmentShortLabel("2nd Half Total"), "H2 Total");
  assert.equal(segmentShortLabel("1st Half Spread"), "H1 Spread");
  // Innings segments keep their existing form.
  assert.equal(segmentShortLabel("1st 5 Innings Moneyline"), "F5 ML");
  assert.equal(segmentShortLabel("1st 3 Innings Total"), "F3 Total");
  // Full-game markets pass through untouched.
  assert.equal(segmentShortLabel("Moneyline"), "Moneyline");
});

test("CFL first-half keys round-trip to a priceable market key", () => {
  assert.deepEqual(periodMarketKeysForLabel("1st Half Moneyline"), ["h2h_h1"]);
  assert.deepEqual(periodMarketKeysForLabel("1st Half Spread"), ["spreads_h1"]);
  assert.deepEqual(periodMarketKeysForLabel("2nd Half Total"), ["totals_h2"]);
  assert.deepEqual(marketKeysForMarket("1st Half Moneyline"), ["h2h_h1"]);
});
