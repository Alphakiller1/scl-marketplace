import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const leaderboardQuery = readFileSync("src/lib/queries/leaderboard.ts", "utf8");
const statusAction = readFileSync(
  "src/lib/actions/account-status.action.ts",
  "utf8",
);
const statusControl = readFileSync(
  "src/components/scl/account-status-control.tsx",
  "utf8",
);

test("disabled cappers are excluded and the leaderboard cache expires immediately", () => {
  assert.match(leaderboardQuery, /accountStatus: "ACTIVE"/);
  assert.match(statusAction, /revalidateTag\("leaderboard", \{ expire: 0 \}\)/);
  assert.match(statusAction, /revalidatePath\("\/leaderboard"\)/);
  assert.match(statusControl, /Disabled — remove from leaderboards/);
  assert.match(statusControl, /plays and\s+audit history are retained/i);
});
