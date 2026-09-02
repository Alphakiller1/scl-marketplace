import assert from "node:assert/strict";
import { test } from "node:test";

import {
  bestAvailableAmerican,
  collectAvailablePrices,
  decidePickIntegrity,
  expandedBoardMarkets,
  getOddsForBook,
  MLB_BATTER_PROP_MARKETS,
  MLB_PITCHER_PROP_MARKETS,
  PROP_MARKET_LABEL,
  PROP_MARKETS_BY_SPORT,
  propMarketLabel,
  impliedProbFromAmerican,
  marketKeysForMarket,
  medianAmerican,
  verificationMarkets,
  verifyOdds,
  type RawEventOdds,
  type VerifyResult,
  boardPriceIsPlausible,
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

test("expanded tennis boards request featured and alternate full-match lines", () => {
  assert.deepEqual(expandedBoardMarkets("TENNIS"), [
    "spreads",
    "totals",
    "alternate_spreads",
    "alternate_totals",
  ]);
});

test("MLB expanded boards carry the full pitcher and hitter card", () => {
  const mlb = expandedBoardMarkets("MLB");
  // Every line a book prices for a pitcher and a hitter, featured key plus the
  // milestone ladder. A capper who cannot tap the line he bet types it as free
  // text, and free text never reaches the verified record.
  for (const key of [...MLB_PITCHER_PROP_MARKETS, ...MLB_BATTER_PROP_MARKETS]) {
    assert.ok(mlb.includes(key), `MLB should request ${key}`);
    assert.ok(
      mlb.includes(`${key}_alternate`),
      `MLB should request ${key}_alternate`,
    );
  }
  // Both halves of the shared baseball counting stats, under separate keys.
  for (const key of [
    "pitcher_walks",
    "batter_walks",
    "pitcher_strikeouts",
    "batter_strikeouts",
    "pitcher_hits_allowed",
    "batter_hits",
  ]) {
    assert.ok(mlb.includes(key), `MLB should request ${key}`);
  }
  // Yes/No markets carry no `point`, and the board drops a selection without a
  // line — requesting them would be billed on every event and render nothing.
  for (const key of [
    "pitcher_record_a_win",
    "batter_first_home_run",
    "batter_fantasy_score",
  ]) {
    assert.ok(!mlb.includes(key), `MLB should not request ${key}`);
  }
  // Full alternate team totals, not just the featured line per club.
  assert.ok(mlb.includes("team_totals"));
  assert.ok(mlb.includes("alternate_team_totals"));
});

test("every requested prop key has a display label, so nothing is billed then dropped", () => {
  for (const [sport, keys] of Object.entries(PROP_MARKETS_BY_SPORT)) {
    for (const key of keys) {
      assert.ok(
        propMarketLabel(key),
        `${sport} requests ${key} with no label — it would be fetched, billed and discarded`,
      );
      assert.ok(
        propMarketLabel(`${key}_alternate`),
        `${sport} requests ${key}_alternate with no label`,
      );
    }
  }
});

test("prop display labels stay unique, so a label maps back to one market", () => {
  const labels = Object.values(PROP_MARKET_LABEL);
  assert.equal(
    new Set(labels.map((label) => label.toLowerCase())).size,
    labels.length,
  );
  // The specific collision that matters: a hitter's walks and the walks a
  // pitcher issued settle from different halves of the box score.
  assert.notEqual(
    PROP_MARKET_LABEL.batter_walks,
    PROP_MARKET_LABEL.pitcher_walks,
  );
  assert.notEqual(
    PROP_MARKET_LABEL.batter_strikeouts,
    PROP_MARKET_LABEL.pitcher_strikeouts,
  );
});

test("WNBA expanded boards carry the full player card", () => {
  const wnba = expandedBoardMarkets("WNBA");
  for (const key of [
    "player_threes",
    "player_blocks",
    "player_steals",
    "player_turnovers",
    "player_points_rebounds",
    "player_points_assists",
    "player_rebounds_assists",
    "player_points_rebounds_assists",
  ]) {
    assert.ok(wnba.includes(key), `WNBA should request ${key}`);
    assert.ok(
      wnba.includes(`${key}_alternate`),
      `WNBA should request ${key}_alternate`,
    );
  }
});

test("football is surface-level odds only", () => {
  // h2h/spreads/totals already arrive on the shared slate, so the per-event
  // call has nothing to add and is never billed.
  assert.deepEqual(expandedBoardMarkets("NFL"), []);
  assert.deepEqual(expandedBoardMarkets("NCAAF"), []);
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
    "batter_total_bases",
    "batter_total_bases_alternate",
    "batter_home_runs",
    "batter_home_runs_alternate",
    "batter_rbis",
    "batter_rbis_alternate",
    "batter_runs_scored",
    "batter_runs_scored_alternate",
    "batter_hits_runs_rbis",
    "batter_hits_runs_rbis_alternate",
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
  assert.deepEqual(marketKeysForMarket("Total Bases"), [
    "batter_total_bases",
    "batter_total_bases_alternate",
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

// ── board-confirmation bound ─────────────────────────────────────────────────

test("boardPriceIsPlausible accepts a worse price however far the market moved", () => {
  // Claiming less than the board offers can only understate a record.
  for (const claimedAmerican of [-110, -140, -300, -2000]) {
    assert.equal(
      boardPriceIsPlausible({
        claimedAmerican,
        availableAmerican: [-105, -110],
      }),
      true,
      `expected ${claimedAmerican} to be plausible`,
    );
  }
});

test("boardPriceIsPlausible bounds payout, not probability points", () => {
  // Best -105 → decimal 1.9524; 8% ceiling is 2.1086 (about +111).
  assert.equal(
    boardPriceIsPlausible({
      claimedAmerican: 105,
      availableAmerican: [-105, -110],
    }),
    true,
  );
  assert.equal(
    boardPriceIsPlausible({
      claimedAmerican: 150,
      availableAmerican: [-105, -110],
    }),
    false,
  );
});

test("boardPriceIsPlausible is tighter than the flat band on longshots", () => {
  // A +900 board price: the flat 2-point band would admit +1150 (25% more
  // payout) — exactly where inflating a price is worth the most. This does not.
  assert.equal(
    boardPriceIsPlausible({ claimedAmerican: 970, availableAmerican: [900] }),
    true,
  );
  assert.equal(
    boardPriceIsPlausible({ claimedAmerican: 1150, availableAmerican: [900] }),
    false,
  );
  assert.equal(
    verifyOdds({ claimedAmerican: 1150, availableAmerican: [900] }).status,
    "verified",
  );
});

test("boardPriceIsPlausible admits the real drift that broke parlays", () => {
  // Production leg: Jackson Chourio Over 0.5 captured at -325, board best since
  // moved to -449. The widest genuine drift in the replayed sample (6.95%).
  assert.equal(
    boardPriceIsPlausible({
      claimedAmerican: -325,
      availableAmerican: [-449, -400],
    }),
    true,
  );
});

test("boardPriceIsPlausible refuses a claim with nothing to bound it against", () => {
  assert.equal(
    boardPriceIsPlausible({ claimedAmerican: -110, availableAmerican: [] }),
    false,
  );
});
