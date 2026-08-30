import assert from "node:assert/strict";
import test from "node:test";

import {
  allowedExpandedMarkets,
  canReserveOddsCredits,
  defaultSportControl,
  estimatedRunCredits,
  expandedMarketGroups,
  isMissingOddsControlStorageError,
  LEGACY_SCHEDULED_SPORTS,
  ODDS_CONTROL_SPORTS,
  selectionAllowedForMarkets,
} from "@/lib/odds-control";
import {
  oddsControlSettingsSchema,
  oddsRunRequestSchema,
} from "@/lib/schemas/odds-control.schema";

test("default owner controls validate against the supported market registry", () => {
  const parsed = oddsControlSettingsSchema.safeParse({
    managedSchedulingEnabled: false,
    paused: false,
    dailyCreditLimit: 2_000,
    weeklyCreditLimit: 10_000,
    monthlyCreditLimit: 20_000,
    perRunCreditLimit: 2_000,
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

test("default managed footprint cannot silently add paid sports", () => {
  for (const sport of ODDS_CONTROL_SPORTS) {
    const control = defaultSportControl(sport);
    assert.equal(control.enabled, LEGACY_SCHEDULED_SPORTS.has(sport));
    assert.equal(control.surfaceEnabled, LEGACY_SCHEDULED_SPORTS.has(sport));
  }
  assert.deepEqual([...LEGACY_SCHEDULED_SPORTS].sort(), [
    "MLB",
    "NFL",
    "SOCCER",
    "TENNIS",
    "WNBA",
  ]);
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

test("credit reservations enforce local limits and a current provider reserve", () => {
  const now = new Date("2026-08-29T12:00:00.000Z");
  const baseline = {
    todayCredits: 100,
    weekCredits: 200,
    monthCredits: 300,
    reservedCredits: 20,
    estimatedCredits: 30,
    dailyLimit: 1_000,
    weeklyLimit: 2_000,
    monthlyLimit: 3_000,
    perRunLimit: 1_000,
    providerRemaining: 1_100,
    providerBalanceUpdatedAt: now,
    providerReserve: 1_000,
    now,
  };
  assert.equal(canReserveOddsCredits(baseline), true);
  assert.equal(
    canReserveOddsCredits({ ...baseline, providerRemaining: 1_049 }),
    false,
  );
  assert.equal(canReserveOddsCredits({ ...baseline, dailyLimit: 149 }), false);
  assert.equal(canReserveOddsCredits({ ...baseline, weeklyLimit: 249 }), false);
  assert.equal(canReserveOddsCredits({ ...baseline, perRunLimit: 29 }), false);
  assert.equal(
    canReserveOddsCredits({ ...baseline, monthlyLimit: 349 }),
    false,
  );
});

test("an old key balance cannot permanently block a replacement key", () => {
  const now = new Date("2026-08-29T12:00:00.000Z");
  assert.equal(
    canReserveOddsCredits({
      todayCredits: 0,
      weekCredits: 0,
      monthCredits: 0,
      reservedCredits: 0,
      estimatedCredits: 3,
      dailyLimit: 100,
      weeklyLimit: 500,
      monthlyLimit: 1_000,
      perRunLimit: 100,
      providerRemaining: 0,
      providerBalanceUpdatedAt: new Date("2026-08-28T11:59:59.999Z"),
      providerReserve: 100,
      now,
    }),
    true,
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
    perRunCreditLimit: 2_000,
    warningPercent: 70,
    reserveCredits: 1_000,
    timezone: "America/New_York",
    sports,
  });
  assert.equal(parsed.success, false);
});

test("tampered duplicate markets and league controls fail validation", () => {
  const sports = ODDS_CONTROL_SPORTS.map((sport) => {
    const {
      nextSurfaceRunAt: _nextSurfaceRunAt,
      nextExpandedRunAt: _nextExpandedRunAt,
      lastSurfaceRunAt: _lastSurfaceRunAt,
      lastExpandedRunAt: _lastExpandedRunAt,
      ...control
    } = defaultSportControl(sport);
    if (sport === "MLB") {
      return { ...control, surfaceMarkets: ["h2h", "h2h"] };
    }
    if (sport === "TENNIS") {
      return { ...control, leagues: ["bad tour key"] };
    }
    return control;
  });
  const parsed = oddsControlSettingsSchema.safeParse({
    managedSchedulingEnabled: false,
    paused: false,
    dailyCreditLimit: 2_000,
    weeklyCreditLimit: 10_000,
    monthlyCreditLimit: 20_000,
    perRunCreditLimit: 2_000,
    warningPercent: 70,
    reserveCredits: 1_000,
    timezone: "America/New_York",
    sports,
  });
  assert.equal(parsed.success, false);
});

test("only a missing control-table error permits legacy rollout behavior", () => {
  assert.equal(isMissingOddsControlStorageError({ code: "P2021" }), true);
  assert.equal(
    isMissingOddsControlStorageError(
      new Error('relation "scl.OddsControlConfig" does not exist'),
    ),
    true,
  );
  assert.equal(isMissingOddsControlStorageError({ code: "P1001" }), false);
  assert.equal(
    isMissingOddsControlStorageError(new Error("connection timed out")),
    false,
  );
});

test("manual run input accepts only a supported sport and tier", () => {
  assert.equal(
    oddsRunRequestSchema.safeParse({ sport: "MLB", tier: "surface" }).success,
    true,
  );
  assert.equal(
    oddsRunRequestSchema.safeParse({ sport: "CRICKET", tier: "surface" })
      .success,
    false,
  );
  assert.equal(
    oddsRunRequestSchema.safeParse({ sport: "MLB", tier: "everything" })
      .success,
    false,
  );
});
