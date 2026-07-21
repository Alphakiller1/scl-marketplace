import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAllDiscoverLanes,
  buildMarketBeatersLane,
  buildNewlyCredibleLane,
  buildProvenLane,
  buildSpecialistsLane,
  buildVerifiedMonthLane,
  DISCOVER_LANE_LIMIT,
  DISCOVER_LANES,
  DISCOVER_SIGNAL_FLOOR,
  discoverLaneEmptyDescription,
  filterDiscoverPublicPlays,
  NEWLY_CREDIBLE_MIN_VERIFIED_SHARE,
  pickSpecialty,
  type DiscoverCapperInput,
  type DiscoverPlayRow,
} from "@/lib/discover-lanes";
import type { CapperSummary } from "@/lib/mock";
import { MATURITY } from "@/lib/sample";

function baseCapper(overrides: Partial<CapperSummary> = {}): CapperSummary {
  return {
    id: "c1",
    name: "alpha",
    handle: "alpha",
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
    avgClv: null,
    ...overrides,
  };
}

function play(
  partial: Partial<DiscoverPlayRow> &
    Pick<DiscoverPlayRow, "outcome" | "units" | "profitUnits">,
): DiscoverPlayRow {
  return {
    sport: "NBA",
    market: "Spread",
    createdAt: new Date("2026-07-01T12:00:00Z"),
    gradedAt: new Date("2026-07-01T20:00:00Z"),
    verificationTier: "VERIFIED",
    clvPts: null,
    ...partial,
  };
}

function nPlays(
  count: number,
  opts: Partial<DiscoverPlayRow> = {},
): DiscoverPlayRow[] {
  return Array.from({ length: count }, (_, i) =>
    play({
      outcome: i % 3 === 0 ? "LOSS" : "WIN",
      units: 1,
      profitUnits: i % 3 === 0 ? -1 : 0.91,
      createdAt: new Date(Date.UTC(2026, 6, 1 + (i % 20))),
      ...opts,
    }),
  );
}

test("DISCOVER_SIGNAL_FLOOR matches MIN_GRADED_FOR_SIGNAL", () => {
  assert.equal(DISCOVER_SIGNAL_FLOOR, 10);
});

test("Discover lanes stay curated while the full directory remains separate", () => {
  assert.equal(DISCOVER_LANE_LIMIT, 4);
});

test("Discover excludes QA-marked plays before public aggregation", () => {
  const plays = filterDiscoverPublicPlays([
    { id: "qa", notes: "DISPOSABLE QA TEST" },
    { id: "real", notes: "Testing the waters on this line" },
    { id: "empty", notes: null },
  ]);

  assert.deepEqual(
    plays.map((row) => row.id),
    ["real", "empty"],
  );
});

test("proven lane requires established sample — does not fill with early records", () => {
  const early: DiscoverCapperInput = {
    summary: baseCapper({
      id: "early",
      handle: "early",
      settledPicks: 12,
      roi: 40,
    }),
    plays: nPlays(12),
  };
  const proven: DiscoverCapperInput = {
    summary: baseCapper({
      id: "proven",
      handle: "proven",
      settledPicks: MATURITY.ESTABLISHED,
      roi: 8,
      units: 12,
    }),
    plays: nPlays(MATURITY.ESTABLISHED),
  };
  const lane = buildProvenLane([early, proven]);
  assert.equal(lane.length, 1);
  assert.equal(lane[0].capper.handle, "proven");
  assert.equal(lane[0].primaryLabel, "Long-Term ROI");
});

test("verified month lane requires board-verified graded signal in window", () => {
  const since = new Date("2026-06-15T00:00:00Z");
  const selfReported: DiscoverCapperInput = {
    summary: baseCapper({ id: "sr", handle: "sr", settledPicks: 20 }),
    plays: nPlays(20, {
      verificationTier: "SELF_REPORTED",
      createdAt: new Date("2026-07-01T00:00:00Z"),
    }),
  };
  const verified: DiscoverCapperInput = {
    summary: baseCapper({ id: "v", handle: "v", settledPicks: 20 }),
    plays: nPlays(12, {
      verificationTier: "VERIFIED",
      createdAt: new Date("2026-07-01T00:00:00Z"),
    }),
  };
  const lane = buildVerifiedMonthLane([selfReported, verified], since);
  assert.equal(lane.length, 1);
  assert.equal(lane[0].capper.handle, "v");
  assert.equal(lane[0].primaryLabel, "30-Day ROI");
});

test("specialty lane stays empty without concentrated signal sample", () => {
  const thin: DiscoverCapperInput = {
    summary: baseCapper({ settledPicks: 8 }),
    plays: nPlays(8),
  };
  assert.equal(pickSpecialty(thin.plays), null);
  assert.equal(buildSpecialistsLane([thin]).length, 0);
});

test("specialty lane picks concentrated sport with signal", () => {
  const plays = [
    ...nPlays(12, { sport: "NBA", market: "Spread" }),
    ...nPlays(2, { sport: "MLB", market: "Moneyline" }),
  ];
  const specialty = pickSpecialty(plays);
  assert.ok(specialty);
  assert.equal(specialty?.label, "NBA");
  const lane = buildSpecialistsLane([
    {
      summary: baseCapper({ settledPicks: 14, handle: "spec", units: -25 }),
      plays,
    },
  ]);
  assert.equal(lane.length, 1);
  assert.equal(lane[0].contextLabel, "NBA");
  assert.equal(lane[0].primaryLabel, "Specialty ROI");
  assert.ok(Math.abs(lane[0].capper.units - 3.28) < 1e-9);
});

test("newly credible requires developing sample + high verified share", () => {
  const established: DiscoverCapperInput = {
    summary: baseCapper({
      handle: "old",
      settledPicks: MATURITY.ESTABLISHED,
      verifiedShare: 95,
    }),
    plays: [],
  };
  const lowVerify: DiscoverCapperInput = {
    summary: baseCapper({
      handle: "low",
      settledPicks: 15,
      verifiedShare: NEWLY_CREDIBLE_MIN_VERIFIED_SHARE - 1,
    }),
    plays: [],
  };
  const ok: DiscoverCapperInput = {
    summary: baseCapper({
      handle: "new",
      settledPicks: 15,
      verifiedShare: 90,
    }),
    plays: [],
  };
  const lane = buildNewlyCredibleLane([established, lowVerify, ok]);
  assert.equal(lane.length, 1);
  assert.equal(lane[0].capper.handle, "new");
  assert.equal(lane[0].primaryKind, "verifiedShare");
});

test("market beaters require verified graded positive avg CLV", () => {
  const selfReported: DiscoverCapperInput = {
    summary: baseCapper({ settledPicks: 20 }),
    plays: nPlays(12, {
      verificationTier: "SELF_REPORTED",
      clvPts: 0.05,
    }),
  };
  assert.equal(buildMarketBeatersLane([selfReported]).length, 0);

  const negative: DiscoverCapperInput = {
    summary: baseCapper({ settledPicks: 20 }),
    plays: nPlays(12, {
      verificationTier: "VERIFIED",
      clvPts: -0.02,
    }),
  };
  assert.equal(buildMarketBeatersLane([negative]).length, 0);

  const ok: DiscoverCapperInput = {
    summary: baseCapper({ settledPicks: 20, handle: "beater" }),
    plays: nPlays(12, {
      verificationTier: "VERIFIED",
      clvPts: 0.02,
    }),
  };
  const lane = buildMarketBeatersLane([ok]);
  assert.equal(lane.length, 1);
  assert.equal(lane[0].capper.handle, "beater");
  assert.ok((lane[0].primaryValue ?? 0) > 0);
});

test("DISCOVER_LANES locks exact titles and empty copy", () => {
  const expected = [
    [
      "Proven Over Time",
      "No Capper Currently Meets The Long-Window Sample Requirement.",
    ],
    [
      "Best Verified ROI Over 30 Days",
      "No Capper Has Enough Verified, Graded Picks In The Current 30-Day Window.",
    ],
    [
      "Consistent Specialists",
      "No Capper Has A Large Enough Sport Or Market Sample To Qualify.",
    ],
    [
      "Newly Credible",
      "No Newer Capper Currently Meets Both The Verification And Sample Requirements.",
    ],
    [
      "Market Beaters",
      "No Capper Has Enough Closing-Line Snapshots To Qualify.",
    ],
  ] as const;
  for (let i = 0; i < expected.length; i++) {
    assert.equal(DISCOVER_LANES[i].title, expected[i][0]);
    assert.equal(DISCOVER_LANES[i].empty, expected[i][1]);
  }
  assert.equal(
    DISCOVER_LANES.find((l) => l.id === "newly_credible")?.explainer,
    "Newer Cappers With A High Board-Verified Share And A Growing Graded Sample.",
  );
  assert.equal(
    discoverLaneEmptyDescription("proven"),
    "This Lane Remains Empty Until A Capper Meets Its Published Criteria.",
  );
  assert.equal(
    discoverLaneEmptyDescription("market_beaters"),
    "Avg CLV Compares Submitted Prices With Market Closing Prices. It Does Not Predict Results.",
  );
});

test("buildAllDiscoverLanes never fabricates entries on empty input", () => {
  const lanes = buildAllDiscoverLanes([]);
  assert.equal(lanes.length, 5);
  for (const lane of lanes) {
    assert.equal(lane.entries.length, 0);
    assert.ok(lane.empty.length > 0);
  }
});
