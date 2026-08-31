import assert from "node:assert/strict";
import test from "node:test";

import { oddsStrategyForecast } from "@/lib/odds-control";
import { ODDS_CONTROL_PRESETS } from "@/lib/odds-control-presets";
import { oddsControlSettingsSchema } from "@/lib/schemas/odds-control.schema";

test("owner presets validate and model between 80K and 95K monthly usage", () => {
  for (const preset of ODDS_CONTROL_PRESETS) {
    const settings = { ...preset.config, sports: preset.sports };
    const parsed = oddsControlSettingsSchema.safeParse(settings);
    assert.equal(
      parsed.success,
      true,
      parsed.success ? undefined : parsed.error.issues[0]?.message,
    );

    const forecast = oddsStrategyForecast(settings);
    assert.deepEqual(forecast.blockingReasons, []);
    assert.equal(forecast.totalCreditsPerMonth, preset.monthlyCeiling);
    assert.equal(100_000 - preset.monthlyCeiling, preset.minimumBalance);
    assert.ok(forecast.totalCreditsPerMonth >= 80_000);
    assert.ok(forecast.totalCreditsPerMonth <= 95_000);
    assert.ok(preset.minimumBalance >= 5_000);
    assert.ok(forecast.largestRunCredits <= preset.config.perRunCreditLimit);
  }
});

test("presets expose the requested market matrix without college props", () => {
  for (const preset of ODDS_CONTROL_PRESETS) {
    const bySport = new Map(preset.sports.map((sport) => [sport.sport, sport]));
    const nfl = bySport.get("NFL")!;
    const nba = bySport.get("NBA")!;
    const ncaaf = bySport.get("NCAAF")!;
    const ncaab = bySport.get("NCAAB")!;
    const tennis = bySport.get("TENNIS")!;
    const soccer = bySport.get("SOCCER")!;

    assert.ok(nfl.expandedMarkets.includes("player_pass_yds"));
    assert.ok(nba.expandedMarkets.includes("player_points"));
    assert.deepEqual(ncaaf.expandedMarkets, [
      "alternate_spreads",
      "alternate_totals",
    ]);
    assert.deepEqual(ncaab.expandedMarkets, [
      "alternate_spreads",
      "alternate_totals",
    ]);
    assert.deepEqual(tennis.surfaceMarkets, ["spreads", "totals"]);
    assert.deepEqual(soccer.expandedMarkets, ["double_chance"]);
  }
});

test("playbooks preserve their advertised targets and sport-specific cadence", () => {
  assert.deepEqual(
    ODDS_CONTROL_PRESETS.map((preset) => preset.monthlyCeiling),
    [80_972, 88_040, 94_736],
  );

  const efficient = new Map(
    ODDS_CONTROL_PRESETS[0]!.sports.map((sport) => [sport.sport, sport]),
  );
  const balanced = new Map(
    ODDS_CONTROL_PRESETS[1]!.sports.map((sport) => [sport.sport, sport]),
  );
  const maximum = new Map(
    ODDS_CONTROL_PRESETS[2]!.sports.map((sport) => [sport.sport, sport]),
  );

  assert.equal(efficient.get("NCAAF")!.expandedCadenceMinutes, 360);
  assert.equal(balanced.get("NCAAF")!.expandedCadenceMinutes, 240);
  assert.equal(balanced.get("SOCCER")!.expandedCadenceMinutes, 240);
  assert.equal(maximum.get("NFL")!.surfaceCadenceMinutes, 60);
  assert.equal(maximum.get("NBA")!.surfaceCadenceMinutes, 120);
  assert.equal(maximum.get("NCAAB")!.surfaceCadenceMinutes, 120);
});

test("unsafe managed strategies are rejected before activation", () => {
  const preset = ODDS_CONTROL_PRESETS[1]!;
  const parsed = oddsControlSettingsSchema.safeParse({
    ...preset.config,
    managedSchedulingEnabled: true,
    monthlyCreditLimit: 10_000,
    weeklyCreditLimit: 9_000,
    sports: preset.sports,
  });
  assert.equal(parsed.success, false);
  assert.match(
    parsed.error?.issues[0]?.message ?? "",
    /cannot be activated|reserve must be below/i,
  );
});
