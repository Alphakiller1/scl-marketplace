import assert from "node:assert/strict";
import test from "node:test";

import {
  allowedExpandedMarkets,
  defaultSportControl,
  estimatedRunCredits,
  expandedMarketGroups,
  ODDS_CONTROL_SPORTS,
  selectionAllowedForMarkets,
} from "@/lib/odds-control";
import { oddsControlSettingsSchema } from "@/lib/schemas/odds-control.schema";

test("default owner controls validate against the supported market registry", () => {
  const parsed = oddsControlSettingsSchema.safeParse({
    managedSchedulingEnabled: false,
    paused: false,
    dailyCreditLimit: 2_000,
    weeklyCreditLimit: 10_000,
    monthlyCreditLimit: 20_000,
    warningPercent: 70,
    reserveCredits: 1_000,
    timezone: "America/New_York",
    sports: ODDS_CONTROL_SPORTS.map((sport) => {
      const {
        nextSurfaceRunAt: _nextSurfaceRunAt,
        nextExpandedRunAt: _nextExpandedRunAt,
        lastSurfaceRunAt: _lastSurfaceRunAt,
        lastExpandedRunAt: _lastExpandedRunAt,
        ...control
      } = defaultSportControl(sport);
      return control;
    }),
  });
  assert.equal(parsed.success, true);
});

test("expanded groups cover every supported market exactly through their union", () => {
  for (const sport of ODDS_CONTROL_SPORTS) {
    const grouped = new Set(
      expandedMarketGroups(sport).flatMap((group) => group.markets),
    );
    assert.deepEqual([...grouped].sort(), allowedExpandedMarkets(sport).sort());
  }
});

test("cost preview is a conservative upper bound for surface and expanded runs", () => {
  assert.equal(
    estimatedRunCredits({
      sport: "MLB",
      tier: "surface",
      markets: ["h2h", "spreads", "totals"],
      leagues: [],
      maxEventsPerRun: 20,
    }),
    3,
  );
  assert.equal(
    estimatedRunCredits({
      sport: "SOCCER",
      tier: "surface",
      markets: ["h2h", "spreads", "totals"],
      leagues: ["EPL", "MLS"],
      maxEventsPerRun: 80,
    }),
    6,
  );
  assert.equal(
    estimatedRunCredits({
      sport: "MLB",
      tier: "expanded",
      markets: ["alternate_spreads", "alternate_totals"],
      leagues: [],
      maxEventsPerRun: 12,
    }),
    24,
  );
});

test("disabled cached alternate lines cannot remain publishable", () => {
  assert.equal(
    selectionAllowedForMarkets(
      {
        label: "Away +1.5",
        market: "Spread",
        selection: "Away +1.5",
        side: "Away",
        line: 1.5,
        featured: false,
        oddsAmerican: -110,
      },
      ["spreads"],
    ),
    false,
  );
  assert.equal(
    selectionAllowedForMarkets(
      {
        label: "Away -1.5",
        market: "Spread",
        selection: "Away -1.5",
        side: "Away",
        line: -1.5,
        featured: true,
        oddsAmerican: -110,
      },
      ["spreads"],
    ),
    true,
  );
});

test("invalid limits and unsupported markets fail closed", () => {
  const sports = ODDS_CONTROL_SPORTS.map((sport) => {
    const {
      nextSurfaceRunAt: _nextSurfaceRunAt,
      nextExpandedRunAt: _nextExpandedRunAt,
      lastSurfaceRunAt: _lastSurfaceRunAt,
      lastExpandedRunAt: _lastExpandedRunAt,
      ...control
    } = defaultSportControl(sport);
    return sport === "NFL"
      ? { ...control, surfaceMarkets: ["player_touchdowns"] }
      : control;
  });
  const parsed = oddsControlSettingsSchema.safeParse({
    managedSchedulingEnabled: true,
    paused: false,
    dailyCreditLimit: 2_000,
    weeklyCreditLimit: 1_000,
    monthlyCreditLimit: 20_000,
    warningPercent: 70,
    reserveCredits: 1_000,
    timezone: "America/New_York",
    sports,
  });
  assert.equal(parsed.success, false);
});
