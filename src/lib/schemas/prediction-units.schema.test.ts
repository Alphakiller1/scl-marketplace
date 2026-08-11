import assert from "node:assert/strict";
import test from "node:test";

import { clampPredictionUnits } from "@/lib/prediction-units";
import { createParlaySchema } from "@/lib/schemas/parlay.schema";
import { playSchema } from "@/lib/schemas/play.schema";

const play = {
  sport: "MLB",
  market: "Moneyline",
  selection: "New York Yankees",
  oddsAmerican: -110,
};

const legs = [
  {
    sport: "MLB",
    market: "Moneyline",
    selection: "New York Yankees",
    oddsAmerican: -110,
  },
  {
    sport: "WNBA",
    market: "Spread",
    selection: "Indiana Fever +3.5",
    oddsAmerican: -105,
  },
];

test("straight and parlay predictions accept 1–5 units with hundredths", () => {
  for (const units of [1, 1.25, 3.75, 4.4, 5]) {
    assert.equal(playSchema.safeParse({ ...play, units }).success, true);
    assert.equal(createParlaySchema.safeParse({ units, legs }).success, true);
  }
});

test("server schemas reject stakes outside 1–5 or beyond two decimals", () => {
  for (const units of [0.99, 5.01, 1.001, 4.401]) {
    assert.equal(playSchema.safeParse({ ...play, units }).success, false);
    assert.equal(createParlaySchema.safeParse({ units, legs }).success, false);
  }
});

test("controlled stake inputs clamp to the owner range and precision", () => {
  assert.equal(clampPredictionUnits(0.5), 1);
  assert.equal(clampPredictionUnits(1.25), 1.25);
  assert.equal(clampPredictionUnits(4.401), 4.4);
  assert.equal(clampPredictionUnits(8), 5);
});
