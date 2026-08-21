import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");

const provider = read("src/lib/results/provider.ts");
const cron = read("src/app/api/cron/grade/route.ts");
const admin = read("src/lib/actions/auto-grade.action.ts");
const espn = read("src/lib/results/espn-scores.ts");
const mapper = read("src/lib/results/espn-scoreboard-map.ts");
const match = read("src/lib/results/match.ts");
const grader = read("src/lib/results/auto-grade.ts");

test("production grader fetches Odds API scores for MMA/UFC", () => {
  assert.match(
    provider,
    /ODDS_SCORES_ONLY_SPORTS = \["MMA", "TENNIS", "CFL"\]/,
  );
  assert.match(provider, /oddsApiResultsProvider\(\)/);
  assert.match(
    provider,
    /scoresProviderForSports\(\s*oddsApiResultsProvider\(\),\s*ODDS_SCORES_ONLY_SPORTS/,
  );
  assert.match(cron, /getGradingResultsProvider\(\)/);
  assert.doesNotMatch(
    cron,
    /getResultsProvider\(\)/,
    "cron must stay on the credit-saving MMA scores layer, not the full odds stack",
  );
});

test("admin Grade completed uses the full scores stack and 14-day lookback", () => {
  assert.match(admin, /getResultsProvider\(\)/);
  assert.match(admin, /lookbackDays: ESPN_HISTORICAL_SCOREBOARD_DAYS/);
  assert.doesNotMatch(
    admin,
    /getGradingResultsProvider\(\)/,
    "admin must not reuse the credit-saving cron provider",
  );
  assert.match(grader, /lookbackDays\?: number/);
});

test("ESPN scoreboard covers UFC cards for the 14-day cliff", () => {
  assert.match(espn, /MMA: \{ sport: "mma", league: "ufc" \}/);
  assert.match(mapper, /athlete\?: \{ displayName\?: string/);
  assert.match(mapper, /winner\?: boolean/);
  assert.match(mapper, /for \(const comp of competitions\)/);
  assert.match(match, /MMA_FIXTURE_WINDOW_MS = 12 \* 60 \* 60 \* 1000/);
});

test("CFL scores come from Odds API because ESPN's CFL calendar is dead", () => {
  assert.match(provider, /"CFL"/);
  assert.match(espn, /CFL: \{ sport: "football", league: "cfl" \}/);
});

test("cron health does not treat never-gradable tennis markets as an outage", () => {
  const health = read("src/lib/grading-health.ts");
  const stuck = read("src/lib/results/stuck-plays.ts");
  assert.match(health, /isAutoGradeBlocked/);
  assert.match(stuck, /isAutoGradeBlocked/);
  assert.match(match, /export function isAutoGradeBlocked/);
});
