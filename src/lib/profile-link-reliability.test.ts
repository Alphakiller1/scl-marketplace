import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const profileListSources = [
  "src/components/scl/capper-card.tsx",
  "src/components/scl/compact-capper-row.tsx",
  "src/components/scl/discover-lane-card.tsx",
  "src/components/scl/leaderboard.tsx",
  "src/components/scl/rank-board-table.tsx",
].map((file) => readFileSync(file, "utf8"));
const profileQuerySource = readFileSync("src/lib/queries/capper.ts", "utf8");

test("leaderboard profile links do not prefetch every capper route", () => {
  const links = profileListSources.flatMap((source) => [
    ...source.matchAll(
      /<Link\s+href=\{`\/cappers\/\$\{capper\.handle\}`\}([\s\S]*?)>/g,
    ),
  ]);

  assert.equal(links.length, 9);
  for (const link of links) assert.match(link[1], /prefetch=\{false\}/);
});

test("a failed profile evidence query is not cached as a false 404", () => {
  assert.match(
    profileQuerySource,
    /if \(evidenceFailed\) \{[\s\S]*?throw new Error\(/,
  );
  assert.doesNotMatch(profileQuerySource, /if \(evidenceFailed\) return null/);
});
