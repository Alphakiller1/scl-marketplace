import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const workspaceRoot = process.cwd();

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(workspaceRoot, relativePath), "utf8");
}

test("shared compact controls retain 40px mobile touch targets", () => {
  const buttonSource = readSource("src/components/ui/button.tsx");
  const sportPillsSource = readSource("src/components/scl/sport-pills.tsx");
  const stakeChipsSource = readSource(
    "src/components/scl/stake-quick-chips.tsx",
  );
  const gamePickerSource = readSource("src/components/scl/game-picker.tsx");

  assert.match(buttonSource, /sm: "h-10[\s\S]*?lg:h-9/);
  assert.match(buttonSource, /"icon-sm":[\s\S]*?size-10[\s\S]*?lg:size-9/);
  assert.match(sportPillsSource, /flex h-11 shrink-0 items-center/);
  assert.match(stakeChipsSource, /min-h-10 min-w-10/);
  assert.match(
    gamePickerSource,
    /flex h-11 shrink-0 items-center justify-center/,
  );
});

test("public profile and home filters avoid undersized mobile actions", () => {
  const evidenceBriefSource = readSource(
    "src/components/scl/evidence-brief.tsx",
  );
  const topCappersSource = readSource(
    "src/components/scl/top-cappers-live.tsx",
  );
  const leaderboardFiltersSource = readSource(
    "src/components/scl/leaderboard-filters.tsx",
  );

  assert.match(evidenceBriefSource, /min-h-10 min-w-10 rounded-full/);
  assert.match(evidenceBriefSource, /inline-flex min-h-10 items-center gap-1/);
  assert.match(topCappersSource, /inline-flex min-h-10 min-w-10/);
  assert.match(leaderboardFiltersSource, /min-h-10[\s\S]*?lg:h-8/);
});

test("global headers use legible mobile brand typography", () => {
  const appHeaderSource = readSource("src/components/app-header.tsx");
  const siteHeaderSource = readSource("src/components/site-header.tsx");

  assert.match(appHeaderSource, /max-w-\[8\.75rem\] text-xs/);
  assert.match(siteHeaderSource, /max-w-\[9\.5rem\] text-xs/);
});
