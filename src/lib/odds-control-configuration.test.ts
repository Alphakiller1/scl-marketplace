import assert from "node:assert/strict";
import test from "node:test";

import {
  activeConfiguration,
  baselineMaxEventsPerRun,
  leagueConfigEntries,
  universalConfigEntries,
} from "@/lib/odds-control-configuration";
import {
  DEFAULT_ODDS_CONTROL_CONFIG,
  defaultSportControl,
  ODDS_CONTROL_SPORTS,
} from "@/lib/odds-control";

const config = { ...DEFAULT_ODDS_CONTROL_CONFIG };
const defaults = ODDS_CONTROL_SPORTS.map(defaultSportControl);

test("credit windows are universal and cannot be claimed per league", () => {
  const entries = universalConfigEntries(config, defaults);
  const pooled = [
    "daily-limit",
    "weekly-limit",
    "monthly-limit",
    "per-run-limit",
    "reserve",
  ];
  for (const id of pooled) {
    const entry = entries.find((row) => row.id === id);
    assert.ok(entry, `${id} missing from the universal registry`);
    assert.equal(entry.scope, "universal");
    assert.equal(
      entry.overridable,
      false,
      `${id} is a shared pool — a league must not be shown as able to override it`,
    );
  }
});

test("a league on the shipped defaults overrides nothing", () => {
  const nfl = defaults.find((sport) => sport.sport === "NFL")!;
  const overrides = leagueConfigEntries(nfl).filter(
    (entry) => entry.overridesUniversal,
  );
  assert.deepEqual(overrides, []);
});

test("changing a league's cadence marks only that league as overriding", () => {
  const edited = defaults.map((sport) =>
    sport.sport === "NFL" ? { ...sport, surfaceCadenceMinutes: 60 } : sport,
  );
  const registry = activeConfiguration(config, edited);

  const nfl = registry.leagues.find((league) => league.sport === "NFL")!;
  const cadence = nfl.entries.find((entry) => entry.id === "surface-cadence")!;
  assert.equal(cadence.scope, "league");
  assert.equal(cadence.overridesUniversal, true);
  assert.equal(cadence.value, "Hourly");
  assert.equal(cadence.universalValue, "Every 4 hours");

  for (const league of registry.leagues) {
    if (league.sport === "NFL") continue;
    const other = league.entries.find(
      (entry) => entry.id === "surface-cadence",
    );
    assert.equal(
      other?.overridesUniversal,
      false,
      `${league.sport} must not inherit NFL's override`,
    );
  }

  const universal = universalConfigEntries(config, edited).find(
    (entry) => entry.id === "default-surface-cadence",
  )!;
  assert.deepEqual(universal.overriddenBy, ["NFL"]);
});

test("soccer's higher event cap is reported as a code-level league baseline", () => {
  assert.equal(baselineMaxEventsPerRun("SOCCER"), 80);
  assert.equal(baselineMaxEventsPerRun("NFL"), 20);

  const soccer = defaults.find((sport) => sport.sport === "SOCCER")!;
  const baseline = leagueConfigEntries(soccer).find(
    (entry) => entry.id === "code-event-baseline",
  )!;
  assert.equal(baseline.source, "code");
  assert.equal(baseline.value, "80 events");
  assert.equal(baseline.universalValue, "20 events");

  // The stored cap equals soccer's own baseline, so it is not a second override.
  const stored = leagueConfigEntries(soccer).find(
    (entry) => entry.id === "max-events",
  )!;
  assert.equal(stored.overridesUniversal, false);
});

test("every league entry is scoped to its league and carries the value it replaces", () => {
  for (const league of activeConfiguration(config, defaults).leagues) {
    for (const entry of league.entries) {
      assert.equal(entry.scope, "league");
      assert.ok(
        entry.universalValue,
        `${league.sport}/${entry.id} must name the universal value it sits against`,
      );
    }
    assert.equal(
      league.overrideCount + league.inheritedCount,
      league.entries.length,
    );
  }
});

test("leagues without expanded support say so rather than showing an empty tier", () => {
  const nhl = defaults.find((sport) => sport.sport === "NHL")!;
  const entries = leagueConfigEntries(nhl);
  const expanded = entries.find(
    (entry) => entry.id === "expanded-unsupported",
  )!;
  assert.equal(expanded.value, "Not supported");
  assert.equal(expanded.source, "code");
  assert.equal(
    entries.some((entry) => entry.id === "expanded-markets"),
    false,
  );
});

test("the registry counts leagues that are actually on, and sorts them first", () => {
  const registry = activeConfiguration(config, defaults);
  assert.equal(registry.counts.leaguesTotal, ODDS_CONTROL_SPORTS.length);
  assert.equal(registry.counts.leaguesEnabled, 5);

  const enabled = registry.leagues.filter((league) => league.enabled);
  assert.deepEqual(
    registry.leagues.slice(0, enabled.length).map((league) => league.enabled),
    enabled.map(() => true),
  );
});
