import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

// Asserted against the source text because `auto-grade.ts` is `server-only`
// and cannot be imported here.
test("auto-grade sends stored per-tournament tags to both result providers", () => {
  const grader = fs.readFileSync(
    path.join(root, "src/lib/results/auto-grade.ts"),
    "utf8",
  );
  assert.match(grader, /resultsQueryScopeFor\(targets\)/);
  assert.match(grader, /soccerLeagues: tagsFor\("SOCCER"\)/);
  // Tennis is keyed per tournament exactly like soccer. Leaving it out of the
  // scope is why no tennis play was ever auto-graded: the fetch fell through to
  // `toOddsApiSport("TENNIS")`, which is undefined, and requested nothing.
  assert.match(grader, /tennisTours: tagsFor\("TENNIS"\)/);
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
  assert.match(provider, /fetchSportScores\("TENNIS", tour\)/);
  assert.match(espn, /fetchEspnScoreboardDay\("SOCCER", day, league\)/);
});
