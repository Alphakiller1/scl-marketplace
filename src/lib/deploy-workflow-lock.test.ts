import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * Lock on the one workflow setting that has already regressed once.
 *
 * `deploy.yml` does not deploy — Vercel's Git integration does that on push,
 * independently of GitHub Actions. What it does is verify that the commit just
 * merged is the one production actually serves. So `cancel-in-progress: true`
 * does not stop a deploy; it deletes the check that would notice a deploy going
 * wrong, and it does so precisely when merges come fast and verification matters
 * most.
 *
 * On 2026-08-06 thirteen PRs merged in quick succession, twelve verification
 * runs cancelled each other, and the resulting column of red in the Actions tab
 * was read as "every deploy today was cancelled". Production had in fact served
 * every one of those commits. A session was spent investigating an outage that
 * had never happened.
 *
 * It reads like an obvious minute-saving default, which is exactly why it was
 * set once, fixed, and set again.
 */
/** Checked out CRLF on Windows and LF in CI — normalize before matching. */
function readWorkflow(name: string): string {
  return readFileSync(`.github/workflows/${name}`, "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("the deploy workflow never cancels a verification run in progress", () => {
  const workflow = readWorkflow("deploy.yml");
  const concurrency = workflow.match(
    /^concurrency:\n((?:[ \t#].*\n|\n)*)/m,
  )?.[1];
  assert.ok(concurrency, "deploy.yml should declare a concurrency group");
  assert.match(
    concurrency,
    /cancel-in-progress:\s*false/,
    "deploy.yml must keep `cancel-in-progress: false` — it verifies what production serves, and cancelling only discards that check",
  );
});

/**
 * The counterpart, so the lock above is not mistaken for a blanket rule: on PR
 * branches only the latest commit matters, and cancelling superseded CI runs is
 * the right call. The distinction is what the run is *for*.
 */
test("CI on pull requests still cancels superseded runs", () => {
  assert.match(readWorkflow("ci.yml"), /cancel-in-progress:\s*true/);
});
