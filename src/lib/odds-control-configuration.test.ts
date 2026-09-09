import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  activeConfiguration,
  baselineMaxEventsPerRun,
  leagueConfigEntries,
  universalConfigEntries,
} from "@/lib/odds-control-configuration";
import {
  adjustedOddsRemaining,
  CREDIT_WINDOW_DAYS,
  creditWindowStart,
  DEFAULT_ODDS_CONTROL_CONFIG,
  defaultSportControl,
  clampToPlanStart,
  ODDS_CONTROL_SPORTS,
  ODDS_CREDIT_BALANCE_ADJUSTMENT,
  accountRemainingCredits,
  oddsPlanStart,
  utcDayStart,
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

test("the shipped ceilings match the 100,000 provider plan", () => {
  assert.equal(DEFAULT_ODDS_CONTROL_CONFIG.weeklyCreditLimit, 25_000);
  assert.equal(DEFAULT_ODDS_CONTROL_CONFIG.monthlyCreditLimit, 100_000);

  const entries = universalConfigEntries(config, defaults);
  assert.equal(
    entries.find((row) => row.id === "weekly-limit")?.value,
    "25,000 credits",
  );
  assert.equal(
    entries.find((row) => row.id === "monthly-limit")?.value,
    "100,000 credits",
  );
});

test("both credit windows roll, and include today", () => {
  assert.equal(CREDIT_WINDOW_DAYS.week, 7);
  assert.equal(CREDIT_WINDOW_DAYS.month, 30);

  // Mid-month, so a calendar-month window would start on the 1st and a rolling
  // one would not — the whole point of the change.
  const now = new Date("2026-08-20T15:30:00.000Z");
  assert.equal(
    creditWindowStart(now, CREDIT_WINDOW_DAYS.week).toISOString(),
    "2026-08-14T00:00:00.000Z",
  );
  assert.equal(
    creditWindowStart(now, CREDIT_WINDOW_DAYS.month).toISOString(),
    "2026-07-22T00:00:00.000Z",
  );
  assert.equal(
    utcDayStart(now).toISOString(),
    "2026-08-20T00:00:00.000Z",
    "the daily window is the UTC day containing now",
  );
});

test("a 30-day window carries overspend across a month boundary", () => {
  // The failure a calendar month allowed: blow the budget on the 30th and the
  // limit forgives it on the 1st. Rolling windows must still see it.
  const spentOn = new Date("2026-08-30T12:00:00.000Z");
  const twoDaysLater = new Date("2026-09-01T12:00:00.000Z");
  assert.ok(
    creditWindowStart(twoDaysLater, CREDIT_WINDOW_DAYS.month) <=
      utcDayStart(spentOn),
    "August 30 must still fall inside the window on September 1",
  );
  assert.ok(
    creditWindowStart(twoDaysLater, CREDIT_WINDOW_DAYS.week) <=
      utcDayStart(spentOn),
    "and inside the 7-day window too",
  );
});

test("no credit path computes its own calendar-month window", () => {
  // Display and enforcement must agree on what "last 30 days" means. They drifted
  // once because five call sites each built their own window, and a calendar
  // month among them would silently forgive overspend at a month boundary.
  const creditWindowFiles = [
    "src/lib/queries/odds-control.ts",
    "src/lib/odds-control-runtime.ts",
    "src/lib/odds-verification-control.ts",
    "src/lib/verification-schedule-runtime.ts",
  ];
  const offenders: string[] = [];
  for (const file of creditWindowFiles) {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    source.split("\n").forEach((line, index) => {
      if (/getUTCMonth\(\)\s*,\s*1\s*\)/.test(line)) {
        offenders.push(`${file}:${index + 1}`);
      }
      // A hand-rolled rolling window is the same drift risk as a calendar one.
      if (/utcDay\w*\(\s*new Date\(\s*now\.getTime\(\) -/.test(line)) {
        offenders.push(`${file}:${index + 1} (hand-rolled window)`);
      }
    });
  }
  assert.deepEqual(
    offenders,
    [],
    `derive credit windows from creditWindowStart(): ${offenders.join(", ")}`,
  );
});

test("usage windows never reach behind the current provider plan", () => {
  // Pre-25-Aug usage was spent on a 20,000 key that ran to exhaustion. Averaging
  // an outage into today's burn rate understates it, so every window is floored.
  const planStart = oddsPlanStart();
  assert.equal(planStart.toISOString(), "2026-08-25T00:00:00.000Z");

  const duringPlan = new Date("2026-08-31T12:00:00.000Z");
  const thirtyDaysBack = creditWindowStart(
    duringPlan,
    CREDIT_WINDOW_DAYS.month,
  );
  assert.ok(thirtyDaysBack < planStart, "the raw window predates the plan");
  assert.equal(
    clampToPlanStart(thirtyDaysBack).toISOString(),
    planStart.toISOString(),
  );

  // Once the plan is older than the window, the floor stops applying and a
  // rolling thirty days is a genuine rolling thirty days again.
  const later = new Date("2026-11-01T12:00:00.000Z");
  const laterWindow = creditWindowStart(later, CREDIT_WINDOW_DAYS.month);
  assert.ok(laterWindow > planStart);
  assert.equal(
    clampToPlanStart(laterWindow).toISOString(),
    laterWindow.toISOString(),
  );
});

test("the reported balance includes purchased credits the active key cannot see", () => {
  // `x-requests-remaining` is one key's figure. Credits bought as a top-up, or
  // held on another key in the rollover list, are spendable but absent from it.
  // The adjustment was a stand-in for credits on another rollover key. It
  // outlived the top-up and printed 10,001 while the account held ~84,000.
  assert.equal(ODDS_CREDIT_BALANCE_ADJUSTMENT, 0);
  assert.equal(adjustedOddsRemaining(69_796), 69_796);
  assert.equal(adjustedOddsRemaining(0), 0);

  // An unknown balance stays unknown — the adjustment must not invent one.
  assert.equal(adjustedOddsRemaining(null), null);
  assert.equal(adjustedOddsRemaining(undefined), null);
});

test("the balance ignores a spent key at the head of the rollover list", () => {
  // Real shape of one day on production: a healthy key burning down, plus the
  // exhausted ODDS_API_KEYS[0] that every cold isolate probes first. Reading
  // the most recent row reported 1 credit for an account holding 84,019.
  const day = new Date("2026-09-05T00:00:00.000Z");
  const at = (hhmm: string) => new Date(`2026-09-05T${hhmm}:00.000Z`);
  const usage = [
    { date: day, updatedAt: at("17:47"), remaining: 84211 },
    { date: day, updatedAt: at("19:01"), remaining: 84074 },
    { date: day, updatedAt: at("20:11"), remaining: 84019 },
    { date: day, updatedAt: at("21:00"), remaining: 12 },
    { date: day, updatedAt: at("21:09"), remaining: 1 },
  ];
  // Both keys' CURRENT balances, summed: 84,019 live + 1 on the spent key at
  // the head of the rollover list. Not the high-water mark, and not the spent
  // key alone just because it answered most recently.
  assert.equal(accountRemainingCredits(usage), 84_020);
});

test("only the most recent day of observations counts", () => {
  assert.equal(
    accountRemainingCredits([
      {
        date: new Date("2026-09-03T00:00:00.000Z"),
        updatedAt: new Date("2026-09-03T23:00:00.000Z"),
        remaining: 90_290,
      },
      {
        date: new Date("2026-09-05T00:00:00.000Z"),
        updatedAt: new Date("2026-09-05T20:11:00.000Z"),
        remaining: 84_019,
      },
      {
        date: new Date("2026-09-05T00:00:00.000Z"),
        updatedAt: new Date("2026-09-05T21:09:00.000Z"),
        remaining: 1,
      },
    ]),
    84_020,
  );
});

test("two healthy keys are summed, not picked between", () => {
  // The case the old code could never report: a top-up key alongside the
  // main one. Reading either single key understates the account by the other.
  const day = new Date("2026-09-05T00:00:00.000Z");
  assert.equal(
    accountRemainingCredits([
      {
        date: day,
        updatedAt: new Date("2026-09-05T20:00:00.000Z"),
        remaining: 84_019,
      },
      {
        date: day,
        updatedAt: new Date("2026-09-05T21:00:00.000Z"),
        remaining: 20_000,
      },
    ]),
    104_019,
  );
});

test("a dying key's own readings do not count twice", () => {
  // 12 -> 1 is one key running out, not two keys. A purely proportional split
  // would treat that 92% drop as a second key and double-count it.
  const day = new Date("2026-09-05T00:00:00.000Z");
  assert.equal(
    accountRemainingCredits([
      {
        date: day,
        updatedAt: new Date("2026-09-05T21:00:00.000Z"),
        remaining: 12,
      },
      {
        date: day,
        updatedAt: new Date("2026-09-05T21:09:00.000Z"),
        remaining: 1,
      },
    ]),
    1,
  );
});

test("no observation at all reports unknown, not zero", () => {
  assert.equal(accountRemainingCredits([]), null);
  assert.equal(
    accountRemainingCredits([
      {
        date: new Date("2026-09-05T00:00:00.000Z"),
        updatedAt: new Date("2026-09-05T21:09:00.000Z"),
        remaining: null,
      },
    ]),
    null,
  );
});
