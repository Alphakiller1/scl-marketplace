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

test("population resolves the IPv4 Supabase pooler before fetching odds", () => {
  assert.match(workflow, /pooler\.supabase\.com/);
  assert.match(workflow, /for \(const tenant of \[0, 1\]\)/);
  assert.match(workflow, /for \(const port of \[5432, 6543\]\)/);
  assert.match(workflow, /No odds credits were spent/);
  assert.match(workflow, /DATABASE_URL<<SCL_DATABASE_URL/);
  assert.doesNotMatch(
    workflow,
    /Populate\n\s+env:\n\s+DATABASE_URL: \$\{\{ secrets\.DATABASE_URL \}\}/,
  );
});
