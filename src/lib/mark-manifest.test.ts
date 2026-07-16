import assert from "node:assert/strict";
import test from "node:test";

import {
  leagueMarkSrc,
  normalizeLeagueKey,
  teamMarkSrc,
} from "@/lib/mark-manifest";

test("leagueMarkSrc resolves manifest leagues", () => {
  assert.equal(leagueMarkSrc("MLB"), "/marks/leagues/mlb.svg");
  assert.equal(leagueMarkSrc("nba"), "/marks/leagues/nba.svg");
  assert.equal(leagueMarkSrc(""), undefined);
  assert.equal(leagueMarkSrc("Quidditch"), undefined);
});

test("normalizeLeagueKey maps aliases to canonical keys", () => {
  assert.equal(normalizeLeagueKey("Major League Baseball"), "MLB");
  assert.equal(normalizeLeagueKey("UFC"), "MMA");
  assert.equal(normalizeLeagueKey("college football"), "NCAAF");
});

test("teamMarkSrc returns undefined when manifest has no entry", () => {
  assert.equal(teamMarkSrc("MLB", "LAD"), undefined);
  assert.equal(teamMarkSrc("MLB", ""), undefined);
});
