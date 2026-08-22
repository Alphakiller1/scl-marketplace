import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("OG cards target one handle and do not scan the leaderboard", () => {
  const source = readFileSync("src/lib/og/load-capper-og.ts", "utf8");
  assert.match(source, /getPublicCapperByHandle/);
  assert.doesNotMatch(source, /getLeaderboardResult/);
});
