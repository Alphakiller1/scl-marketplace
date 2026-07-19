import assert from "node:assert/strict";
import test from "node:test";

import type { CapperSummary } from "@/lib/mock";
import {
  indexPackageEvidence,
  packageEvidenceFromCapper,
} from "@/lib/package-register";

function capper(overrides: Partial<CapperSummary> = {}): CapperSummary {
  return {
    id: "capper-1",
    name: "recordkeeper",
    handle: "recordkeeper",
    verified: true,
    topSport: "NBA",
    rank: 0,
    rankDelta: 0,
    record: { w: 0, l: 0, p: 0 },
    winPct: 0,
    units: 0,
    roi: 0,
    streak: 0,
    recentForm: [],
    trophies: [],
    settledPicks: 0,
    verifiedShare: 0,
    ...overrides,
  };
}

test("zero-grade marketplace evidence uses honest null performance", () => {
  assert.deepEqual(packageEvidenceFromCapper(capper()), {
    settledPicks: 0,
    record: null,
    roi: null,
    units: null,
    verifiedShare: null,
    provisional: true,
  });
});

test("early evidence remains measurable and provisional", () => {
  assert.deepEqual(
    packageEvidenceFromCapper(
      capper({
        record: { w: 3, l: 2, p: 0 },
        settledPicks: 5,
        roi: 8.5,
        units: 2.25,
        verifiedShare: 80,
      }),
    ),
    {
      settledPicks: 5,
      record: { w: 3, l: 2, p: 0 },
      roi: 8.5,
      units: 2.25,
      verifiedShare: 80,
      provisional: true,
    },
  );
});

test("evidence index joins by stable capper id", () => {
  const indexed = indexPackageEvidence([
    capper({ id: "one" }),
    capper({ id: "two", settledPicks: 12 }),
  ]);

  assert.equal(indexed.size, 2);
  assert.equal(indexed.get("two")?.provisional, false);
});
