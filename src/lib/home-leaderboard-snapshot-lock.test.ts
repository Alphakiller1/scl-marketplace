import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const homeSource = readFileSync("src/app/(marketing)/page.tsx", "utf8");
test("homepage hero replaces the leaderboard snapshot with SCL Honors", () => {
  assert.match(homeSource, /getCurrentHonors\(\)/);
  assert.match(homeSource, /<HonorsSpotlight/);
  assert.doesNotMatch(homeSource, /LiveBoardShell/);
  assert.doesNotMatch(homeSource, /LeaderboardSnapshot/);
});
