import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/populate-odds.yml", "utf8");

test("population performs exactly two scheduled surface refreshes per day", () => {
  const cronLines = workflow.match(/^\s*- cron:/gm) ?? [];
  assert.equal(cronLines.length, 2);
  assert.match(workflow, /EXPANDED:.*event_name == 'schedule'.*'0'/);
  assert.match(workflow, /cancel-in-progress: false/);
});

test("population reads the odds key only from the protected environment", () => {
  assert.match(workflow, /environment: Production/);
  assert.match(workflow, /ODDS_KEY: \$\{\{ secrets\.ODDS_API_KEY \}\}/);
  assert.doesNotMatch(workflow, /inputs\.odds_key/);
});
