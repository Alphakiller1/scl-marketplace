import assert from "node:assert/strict";
import test from "node:test";

import { oddsStrategyForecast } from "@/lib/odds-control";
import { ODDS_CONTROL_PRESETS } from "@/lib/odds-control-presets";
import { oddsControlSettingsSchema } from "@/lib/schemas/odds-control.schema";

test("owner presets validate and preserve their advertised monthly ceiling", () => {
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
    assert.equal(
      forecast.totalCreditsPerMonth + preset.config.reserveCredits,
      preset.monthlyCeiling,
    );
    assert.equal(100_000 - preset.monthlyCeiling, preset.minimumBalance);
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
