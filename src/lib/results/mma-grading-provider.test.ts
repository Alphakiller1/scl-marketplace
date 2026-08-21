import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const provider = fs.readFileSync(
  path.join(process.cwd(), "src/lib/results/provider.ts"),
  "utf8",
);
const cron = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/cron/grade/route.ts"),
  "utf8",
);
const admin = fs.readFileSync(
  path.join(process.cwd(), "src/lib/actions/auto-grade.action.ts"),
  "utf8",
);

test("production grader fetches Odds API scores for MMA/UFC", () => {
  assert.match(provider, /ODDS_SCORES_ONLY_SPORTS = \["MMA", "TENNIS"\]/);
  assert.match(provider, /oddsApiResultsProvider\(\)/);
  assert.match(
    provider,
    /scoresProviderForSports\(\s*oddsApiResultsProvider\(\),\s*ODDS_SCORES_ONLY_SPORTS/,
  );
  assert.match(cron, /getGradingResultsProvider\(\)/);
  assert.match(admin, /getGradingResultsProvider\(\)/);
  assert.doesNotMatch(
    cron,
    /getResultsProvider\(\)/,
    "cron must not skip the MMA scores layer",
  );
});
