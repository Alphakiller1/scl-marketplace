import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const homeSource = readFileSync("src/app/(marketing)/page.tsx", "utf8");

test("homepage hero promotes SCL Leaderboard Honors", () => {
  assert.match(homeSource, /<HonorsShowcase awards=\{featuredList\(honors\)\}/);
  assert.match(homeSource, /getFeaturedHonors\(\)/);
  assert.doesNotMatch(
    homeSource,
    /<LiveBoardShell/,
    "the Honors showcase replaces the hero snapshot",
  );
});

test("homepage still carries the leaderboard below the hero", () => {
  assert.match(homeSource, /<HomeTopBoard \/>/);
  assert.match(homeSource, /sortLeaderboard\(leaderboard\.cappers, "units"\)/);
  assert.match(homeSource, /window: "90d"/);
});
