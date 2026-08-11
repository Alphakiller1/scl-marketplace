import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("auto-grade sends stored soccer leagues to both result providers", () => {
  const grader = fs.readFileSync(
    path.join(root, "src/lib/results/auto-grade.ts"),
    "utf8",
  );
  assert.match(grader, /resultsQueryScopeFor\(pending\)/);
  assert.match(grader, /play\.sport === "SOCCER"/);
  assert.match(grader, /league: true/);
});

test("primary and ESPN fallbacks fan generic SOCCER out by league", () => {
  const provider = fs.readFileSync(
    path.join(root, "src/lib/results/provider.ts"),
    "utf8",
  );
  const espn = fs.readFileSync(
    path.join(root, "src/lib/results/espn-scores.ts"),
    "utf8",
  );
  assert.match(provider, /resolveOddsApiSport\(sclSport, league\)/);
  assert.match(provider, /fetchSportScores\("SOCCER", league\)/);
  assert.match(espn, /fetchEspnScoreboardDay\("SOCCER", day, league\)/);
});
