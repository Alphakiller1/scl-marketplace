import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const homeSource = readFileSync("src/app/(marketing)/page.tsx", "utf8");
const snapshotSource = readFileSync(
  "src/components/scl/leaderboard-snapshot.tsx",
  "utf8",
);

test("homepage leaderboard snapshot stays ROI-ranked on the rolling 14-day board", () => {
  assert.doesNotMatch(
    homeSource,
    /sort: "roi"/,
    "hero and top board must share one 14d cache key; ROI sort happens in memory",
  );
  assert.equal(homeSource.match(/window: "14d"/g)?.length, 2);
  assert.doesNotMatch(homeSource, /window: "90d"/);
  assert.match(homeSource, /sortLeaderboard\(cappers, "roi"\)/);
  assert.match(homeSource, /\.slice\(0, 10\)/);
  assert.match(snapshotSource, /Last 14 Days/);
  assert.match(snapshotSource, /window=14d&sort=roi&dir=desc/);
  assert.match(snapshotSource, /Ranked By ROI/);
  assert.match(snapshotSource, /window\.setInterval/);
  assert.match(snapshotSource, /6500/);
});
