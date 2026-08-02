import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCapperProfileMetadata } from "@/lib/capper-profile-seo";
import type { CapperSummary } from "@/lib/mock";

function stub(over: Partial<CapperSummary> = {}): CapperSummary {
  return {
    id: "1",
    name: "demo_capper",
    handle: "demo_capper",
    verified: true,
    topSport: "MLB",
    rank: 0,
    rankDelta: 0,
    record: { w: 1, l: 1, p: 0 },
    winPct: 50,
    units: 0.3,
    roi: 5,
    streak: 0,
    recentForm: [],
    trophies: [],
    settledPicks: 2,
    ...over,
  };
}

test("building profiles use building-record description language", () => {
  const meta = buildCapperProfileMetadata(stub({ rank: 0, settledPicks: 2 }));
  assert.match(String(meta.title), /demo_capper/i);
  assert.match(String(meta.title), /MLB Capper Record/);
  assert.match(String(meta.description), /building record/i);
  assert.doesNotMatch(String(meta.description), /best|guaranteed|locks/i);
});

test("ranked profiles use full record description without hype", () => {
  const meta = buildCapperProfileMetadata(
    stub({ rank: 3, settledPicks: 40, topSport: "NFL" }),
  );
  assert.match(String(meta.title), /NFL Capper Record/);
  assert.match(String(meta.description), /public capper record/i);
  assert.match(String(meta.description), /Sports Capper Leaderboard/);
});

test("multi/unknown sport uses generic title template", () => {
  const meta = buildCapperProfileMetadata(
    stub({ rank: 1, settledPicks: 20, topSport: "MULTI" }),
  );
  assert.match(String(meta.title), /Record, Picks & Verified History/);
});
