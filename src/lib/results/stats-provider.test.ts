import assert from "node:assert/strict";
import { test } from "node:test";

import { mapSummaryToBoxScore } from "@/lib/results/stats-provider";

// Shape mirrors ESPN's public event-summary response (verified against the live API).
const ESPN_SUMMARY = {
  header: {
    competitions: [
      {
        competitors: [
          {
            homeAway: "home",
            linescores: [
              { value: 0 },
              { value: 1 },
              { value: 0 },
              { value: 2 },
              { value: 0 },
              { value: 3 },
            ],
          },
          {
            homeAway: "away",
            linescores: [
              { value: 1 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 1 },
              { value: 0 },
            ],
          },
        ],
      },
    ],
  },
};

test("mapSummaryToBoxScore extracts home/away per-period line-scores", () => {
  const box = mapSummaryToBoxScore(ESPN_SUMMARY);
  assert.ok(box);
  assert.deepEqual(box.homePeriods, [0, 1, 0, 2, 0, 3]);
  assert.deepEqual(box.awayPeriods, [1, 0, 0, 0, 1, 0]);
});

test("mapSummaryToBoxScore returns null on missing/partial data (→ defer)", () => {
  assert.equal(mapSummaryToBoxScore({}), null);
  assert.equal(mapSummaryToBoxScore(null), null);
  assert.equal(
    mapSummaryToBoxScore({
      header: {
        competitions: [{ competitors: [{ homeAway: "home", linescores: [] }] }],
      },
    }),
    null,
  );
});
