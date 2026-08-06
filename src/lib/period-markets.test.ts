import assert from "node:assert/strict";
import test from "node:test";

import {
  isPeriodMarket,
  parsePeriodMarket,
  periodMarketKey,
  periodMarketKeysForLabel,
  periodMarketKeysForSport,
  periodMarketLabel,
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
  assert.deepEqual(periodMarketKeysForSport("NBA"), []);
  assert.ok(!verificationMarkets("NBA").some((m) => m.includes("_innings")));
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
