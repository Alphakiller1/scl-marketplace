import assert from "node:assert/strict";
import { test } from "node:test";

import {
  bestAvailableAmerican,
  collectAvailablePrices,
  decidePickIntegrity,
  expandedBoardMarkets,
  getOddsForBook,
  impliedProbFromAmerican,
  marketKeysForMarket,
  medianAmerican,
  verificationMarkets,
  verifyOdds,
  type RawEventOdds,
  type VerifyResult,
} from "@/lib/odds-verify";

test("impliedProbFromAmerican matches known values", () => {
  assert.ok(Math.abs(impliedProbFromAmerican(100) - 0.5) < 1e-9);
  assert.ok(Math.abs(impliedProbFromAmerican(-100) - 0.5) < 1e-9);
  assert.ok(Math.abs(impliedProbFromAmerican(150) - 0.4) < 1e-9);
  assert.ok(Math.abs(impliedProbFromAmerican(-110) - 110 / 210) < 1e-9);
});

test("bestAvailableAmerican picks the most bettor-favorable price", () => {
  assert.equal(bestAvailableAmerican([-110, 150, 160]), 160); // longest dog
  assert.equal(bestAvailableAmerican([-105, -110, -120]), -105); // cheapest fav
  assert.equal(bestAvailableAmerican([]), null);
});

test("medianAmerican is robust central price", () => {
  assert.equal(medianAmerican([-120, -110, -105]), -110);
  assert.equal(medianAmerican([-110, -105]), -107); // Math.round(-107.5) → -107
  assert.equal(medianAmerican([]), null);
});

test("verifyOdds accepts a claimed price equal to or worse than best available", () => {
  // equal to best
  assert.equal(
    verifyOdds({ claimedAmerican: -110, availableAmerican: [-110, -115] })
      .status,
    "verified",
  );
  // worse than best (capper hurts own ROI — no incentive to lie down)
  assert.equal(
    verifyOdds({ claimedAmerican: -130, availableAmerican: [-110, -115] })
      .status,
    "verified",
  );
});

test("verifyOdds rejects a claimed price better than obtainable beyond tolerance", () => {
  // best available +150 (implied .40); claimed +220 (implied ~.3125) → .3125 < .40 - .02
  const r = verifyOdds({
    claimedAmerican: 220,
    availableAmerican: [150, -110],
  });
  assert.equal(r.status, "rejected");
  if (r.status === "rejected") assert.equal(r.bestAvailable, 150);
});

test("verifyOdds allows a small favorable deviation within tolerance", () => {
  // best +150 (.40); claimed +158 (~.3876) → .3876 >= .40 - .02 → verified
  assert.equal(
    verifyOdds({ claimedAmerican: 158, availableAmerican: [150, -110] }).status,
    "verified",
  );
});

test("verifyOdds is unverifiable when no book offered the market", () => {
  assert.equal(
    verifyOdds({ claimedAmerican: -110, availableAmerican: [] }).status,
    "unverifiable",
  );
});

const EVENT: RawEventOdds = {
  id: "e1",
  bookmakers: [
    {
      key: "draftkings",
      markets: [
        {
          key: "spreads",
          outcomes: [
            { name: "Los Angeles Lakers", price: -110, point: -3.5 },
            { name: "Boston Celtics", price: -110, point: 3.5 },
          ],
        },
        {
          key: "alternate_spreads",
          outcomes: [{ name: "Los Angeles Lakers", price: 150, point: -7.5 }],
        },
        {
          key: "pitcher_strikeouts",
          outcomes: [
            {
              name: "Over",
              price: -120,
              point: 6.5,
              description: "Gerrit Cole",
            },
            {
              name: "Over",
              price: 110,
              point: 6.5,
              description: "Other Pitcher",
            },
          ],
        },
      ],
    },
    {
      key: "fanduel",
      markets: [
        {
          key: "spreads",
          outcomes: [{ name: "Los Angeles Lakers", price: -105, point: -3.5 }],
        },
      ],
    },
  ],
};

test("collectAvailablePrices matches market group + side + line across books", () => {
  const prices = collectAvailablePrices(EVENT, {
    marketKeys: ["spreads", "alternate_spreads"],
    side: "Los Angeles Lakers",
    line: -3.5,
  });
  assert.deepEqual(
    prices.sort((a, b) => a - b),
    [-110, -105],
  );
});

test("collectAvailablePrices resolves an alternate line", () => {
  const prices = collectAvailablePrices(EVENT, {
    marketKeys: ["spreads", "alternate_spreads"],
    side: "Los Angeles Lakers",
    line: -7.5,
  });
  assert.deepEqual(prices, [150]);
});

test("collectAvailablePrices filters a prop by player (description)", () => {
  const prices = collectAvailablePrices(EVENT, {
    marketKeys: ["pitcher_strikeouts"],
    side: "Over",
    line: 6.5,
    player: "Gerrit Cole",
  });
  assert.deepEqual(prices, [-120]);
});

test("verificationMarkets bundles core + curated sport props", () => {
  const mlb = verificationMarkets("MLB");
  assert.ok(mlb.includes("h2h"));
  assert.ok(mlb.includes("alternate_totals"));
  assert.ok(mlb.includes("pitcher_strikeouts"));
  // unknown sport → core markets only. Team totals are core, not per-sport:
  // any sport whose book prices them should surface them.
  assert.deepEqual(verificationMarkets("PGA"), [
    "h2h",
    "spreads",
    "totals",
    "alternate_spreads",
    "alternate_totals",
    "team_totals",
    "alternate_team_totals",
  ]);
});

test("expandedBoardMarkets omits already-loaded featured lines", () => {
  const mlb = expandedBoardMarkets("MLB");
  assert.ok(!mlb.includes("h2h"));
  assert.ok(!mlb.includes("spreads"));
  assert.ok(!mlb.includes("totals"));
  assert.ok(mlb.includes("alternate_spreads"));
  assert.ok(mlb.includes("alternate_spreads_1st_5_innings"));
  assert.ok(mlb.includes("pitcher_strikeouts_alternate"));
});

test("expanded MLB and WNBA boards request the complete owner-required matrix", () => {
  const mlb = expandedBoardMarkets("MLB");
  for (const market of [
    "alternate_spreads",
    "alternate_totals",
    "pitcher_strikeouts",
    "pitcher_strikeouts_alternate",
    "pitcher_outs",
    "pitcher_outs_alternate",
    "pitcher_earned_runs",
    "pitcher_earned_runs_alternate",
    "batter_hits",
    "batter_hits_alternate",
  ]) {
    assert.ok(mlb.includes(market), `MLB should request ${market}`);
  }
  for (const innings of [3, 5, 7]) {
    for (const prefix of [
      "h2h",
      "spreads",
      "alternate_spreads",
      "totals",
      "alternate_totals",
    ]) {
      const market = `${prefix}_1st_${innings}_innings`;
      assert.ok(mlb.includes(market), `MLB should request ${market}`);
    }
  }

  const wnba = expandedBoardMarkets("WNBA");
  for (const market of [
    "alternate_spreads",
    "alternate_totals",
    "player_points",
    "player_points_alternate",
    "player_rebounds",
    "player_rebounds_alternate",
    "player_assists",
    "player_assists_alternate",
  ]) {
    assert.ok(wnba.includes(market), `WNBA should request ${market}`);
  }
  for (const half of [1, 2]) {
    for (const prefix of [
      "h2h",
      "spreads",
      "alternate_spreads",
      "totals",
      "alternate_totals",
    ]) {
      const market = `${prefix}_h${half}`;
      assert.ok(wnba.includes(market), `WNBA should request ${market}`);
    }
  }
});

test("marketKeysForMarket bundles both team-total keys", () => {
  // A pick taken off the alternate ladder is priced only in the alternate key,
  // so verifying against the featured key alone could not find its line.
  assert.deepEqual(marketKeysForMarket("Team Total"), [
    "team_totals",
    "alternate_team_totals",
  ]);
});

test("marketKeysForMarket maps game markets to featured + alternate keys", () => {
  assert.deepEqual(marketKeysForMarket("Moneyline"), ["h2h"]);
  assert.deepEqual(marketKeysForMarket("Spread"), [
    "spreads",
    "alternate_spreads",
  ]);
  assert.deepEqual(marketKeysForMarket("Total"), [
    "totals",
    "alternate_totals",
  ]);
  // Prop display labels resolve back to their Odds API key, bundled with the
  // alternate variant: milestone "X+" lines (6+ strikeouts) live only there, so
  // verifying against the featured key alone could not price such a pick.
  assert.deepEqual(marketKeysForMarket("Strikeouts"), [
    "pitcher_strikeouts",
    "pitcher_strikeouts_alternate",
  ]);
  assert.deepEqual(marketKeysForMarket("Points"), [
    "player_points",
    "player_points_alternate",
  ]);
  // a raw key (or anything unrecognized) is passed through, trimmed
  assert.deepEqual(marketKeysForMarket("  pitcher_strikeouts "), [
    "pitcher_strikeouts",
  ]);
});

const VERIFIED: VerifyResult = {
  status: "verified",
  bestAvailable: -110,
  reference: -110,
  claimedImplied: 0.52,
  bestImplied: 0.52,
};
const REJECTED: VerifyResult = {
  status: "rejected",
  bestAvailable: 150,
  reference: 150,
  reason:
    "Claimed +250 is better than the best available (+150) beyond tolerance.",
  claimedImplied: 0.2857,
  bestImplied: 0.4,
};
const UNVERIFIABLE: VerifyResult = {
  status: "unverifiable",
  reason: "No covered book offered this market/side/line at capture time.",
};

const BEFORE = new Date("2026-07-12T18:00:00Z");
const START = new Date("2026-07-12T23:05:00Z");

test("decidePickIntegrity: strict path (pre-game + verified + event-bound + manual) → VERIFIED", () => {
  const d = decidePickIntegrity({
    now: BEFORE,
    eventStartsAt: START,
    eventBound: true,
    verify: VERIFIED,
    source: "MANUAL",
  });
  assert.equal(d.accept, true);
  if (d.accept) {
    assert.equal(d.tier, "VERIFIED");
    assert.equal(d.loggedPreGame, true);
    assert.equal(d.oddsVerified, true);
  }
});

test("decidePickIntegrity: authorized connector on the strict path → AUTO_VERIFIED", () => {
  const d = decidePickIntegrity({
    now: BEFORE,
    eventStartsAt: START,
    eventBound: true,
    verify: VERIFIED,
    source: "IMPORTED_X",
  });
  assert.equal(d.accept && d.tier, "AUTO_VERIFIED");
});

test("decidePickIntegrity: C1 hard-rejects a pick at/after start time", () => {
  const d = decidePickIntegrity({
    now: START, // exactly at start counts as started
    eventStartsAt: START,
    eventBound: true,
    verify: VERIFIED,
    source: "MANUAL",
  });
  assert.equal(d.accept, false);
});

test("decidePickIntegrity: changed odds do not downgrade a confirmed board pick", () => {
  const d = decidePickIntegrity({
    now: BEFORE,
    eventStartsAt: START,
    eventBound: true,
    verify: REJECTED,
    source: "MANUAL",
  });
  assert.equal(d.accept, true);
  if (d.accept) {
    assert.equal(d.tier, "VERIFIED");
    assert.equal(d.loggedPreGame, true);
    assert.equal(d.oddsVerified, true);
  }
});

test("decidePickIntegrity: provider failure does not downgrade a confirmed board pick", () => {
  const d = decidePickIntegrity({
    now: BEFORE,
    eventStartsAt: START,
    eventBound: true,
    verify: UNVERIFIABLE,
    source: "MANUAL",
  });
  assert.equal(d.accept, true);
  if (d.accept) {
    assert.equal(d.tier, "VERIFIED");
    assert.equal(d.loggedPreGame, true);
    assert.equal(d.oddsVerified, true);
  }
});

test("decidePickIntegrity: skipped follow-up check keeps a confirmed board pick verified", () => {
  const d = decidePickIntegrity({
    now: BEFORE,
    eventStartsAt: START,
    eventBound: true,
    verify: null,
    source: "MANUAL",
  });
  assert.equal(d.accept, true);
  if (d.accept) {
    assert.equal(d.tier, "VERIFIED");
    assert.equal(d.loggedPreGame, true);
    assert.equal(d.oddsVerified, true);
  }
});

test("decidePickIntegrity: free-text pick without an event is rejected", () => {
  const d = decidePickIntegrity({
    now: BEFORE,
    eventStartsAt: null,
    eventBound: false,
    verify: null,
    source: "MANUAL",
  });
  assert.equal(d.accept, false);
  if (!d.accept) {
    assert.equal(d.reason, "Select a pre-game line from the SCL odds board.");
  }
});

test("collectAvailablePrices filters to capper books when bookKeys set", () => {
  const prices = collectAvailablePrices(
    EVENT,
    {
      marketKeys: ["spreads", "alternate_spreads"],
      side: "Los Angeles Lakers",
      line: -3.5,
    },
    { bookKeys: ["fanduel"] },
  );
  assert.deepEqual(prices, [-105]);
});

test("collectAvailablePrices with empty bookKeys matches all-books behavior", () => {
  const all = collectAvailablePrices(EVENT, {
    marketKeys: ["spreads"],
    side: "Los Angeles Lakers",
    line: -3.5,
  });
  const emptyFilter = collectAvailablePrices(
    EVENT,
    {
      marketKeys: ["spreads"],
      side: "Los Angeles Lakers",
      line: -3.5,
    },
    { bookKeys: [] },
  );
  assert.deepEqual(
    all.sort((a, b) => a - b),
    emptyFilter.sort((a, b) => a - b),
  );
});

test("getOddsForBook returns honest null when that book has no line", () => {
  assert.equal(
    getOddsForBook(EVENT, "spreads", "betmgm", {
      side: "Los Angeles Lakers",
      line: -3.5,
    }),
    null,
  );
  assert.equal(
    getOddsForBook(EVENT, "spreads", "fanduel", {
      side: "Los Angeles Lakers",
      line: -3.5,
    }),
    -105,
  );
  assert.equal(
    getOddsForBook(EVENT, "spreads", "draftkings", {
      side: "Los Angeles Lakers",
      line: -3.5,
    }),
    -110,
  );
});
