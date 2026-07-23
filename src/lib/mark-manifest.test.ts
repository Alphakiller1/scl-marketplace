import assert from "node:assert/strict";
import test from "node:test";

import {
  bookMarkSrc,
  leagueMarkSrc,
  normalizeLeagueKey,
  teamMarkSrc,
} from "@/lib/mark-manifest";

test("leagueMarkSrc returns self-hosted marks for major leagues", () => {
  assert.equal(leagueMarkSrc("MLB"), "/marks/leagues/mlb.png?v=6");
  assert.equal(leagueMarkSrc("nba"), "/marks/leagues/nba.png?v=6");
  assert.equal(leagueMarkSrc("NFL"), "/marks/leagues/nfl.svg?v=6");
  assert.equal(leagueMarkSrc("NCAAF"), "/marks/leagues/ncaaf.svg?v=6");
  assert.equal(leagueMarkSrc(""), undefined);
  assert.equal(leagueMarkSrc("Quidditch"), undefined);
});

test("normalizeLeagueKey maps aliases to canonical keys", () => {
  assert.equal(normalizeLeagueKey("Major League Baseball"), "MLB");
  assert.equal(normalizeLeagueKey("UFC"), "MMA");
  assert.equal(normalizeLeagueKey("college football"), "NCAAF");
  assert.equal(normalizeLeagueKey("MLS"), "SOCCER");
});

test("teamMarkSrc returns undefined when manifest has no entry", () => {
  assert.equal(teamMarkSrc("MLB", "LAD"), undefined);
  assert.equal(teamMarkSrc("MLB", ""), undefined);
});

test("bookMarkSrc returns versioned PNG paths for curated sportsbooks", () => {
  assert.equal(bookMarkSrc("draftkings"), "/marks/books/draftkings.png?v=2");
  assert.equal(bookMarkSrc("fanduel"), "/marks/books/fanduel.png?v=2");
  assert.equal(bookMarkSrc(""), undefined);
  assert.equal(bookMarkSrc("unknown"), undefined);
});
