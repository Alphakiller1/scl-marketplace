import assert from "node:assert/strict";
import { test } from "node:test";

import {
  bestAvailableAmerican,
  collectAvailablePrices,
  impliedProbFromAmerican,
  medianAmerican,
  verificationMarkets,
  verifyOdds,
  type RawEventOdds,
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
  // unknown sport → core markets only
  assert.deepEqual(verificationMarkets("PGA"), [
    "h2h",
    "spreads",
    "totals",
    "alternate_spreads",
    "alternate_totals",
  ]);
});
