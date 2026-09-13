import assert from "node:assert/strict";
import test from "node:test";
import { awardMonthLabel, makeHonorAward } from "@/lib/honors";
import { MOCK_CAPPERS } from "@/lib/mock";

test("Cross Sport Parlay Allstar uses the requested monthly abbreviation", () => {
  const now = new Date("2026-08-15T12:00:00Z");
  const award = makeHonorAward(
    {
      name: "Cross Sport Parlay Allstar",
      abbreviation: `🔗 ${awardMonthLabel(now)} ($)`,
      icon: "🔗",
      period: "monthly",
      sport: "Cross-Sports",
      metric: "units",
      minimumPicks: 10,
      winner: MOCK_CAPPERS[0]!,
    },
    now,
  );
  assert.equal(award.abbreviation, "🔗 AUG26 ($)");
  assert.equal(award.metric, "units");
  assert.equal(award.minimumPicks, 10);
  assert.equal(award.visibleFrom.toISOString(), "2026-08-01T00:00:00.000Z");
  assert.equal(award.visibleUntil.toISOString(), "2026-11-01T00:00:00.000Z");
});
