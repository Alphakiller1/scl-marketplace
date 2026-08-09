import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const homeSource = readFileSync("src/app/(marketing)/page.tsx", "utf8");
const snapshotSource = readFileSync(
  "src/components/scl/leaderboard-snapshot.tsx",
  "utf8",
);

test("homepage leaderboard snapshot stays ROI-ranked and rolling", () => {
  assert.match(homeSource, /sort: "roi"/);
  assert.match(homeSource, /sortLeaderboard\(cappers, "roi"\)/);
  assert.match(homeSource, /\.slice\(0, 10\)/);
  assert.match(snapshotSource, /Ranked By ROI/);
  assert.match(snapshotSource, /window\.setInterval/);
  assert.match(snapshotSource, /6500/);
});
