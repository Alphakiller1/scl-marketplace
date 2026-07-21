import assert from "node:assert/strict";

import test from "node:test";

import {
  espnLeagueLogoUrl,
  getLeagueIdentity,
  leagueMarkInitials,
} from "@/lib/leagues";

test("getLeagueIdentity prefers self-hosted league marks", () => {
  const mlb = getLeagueIdentity("MLB");

  assert.equal(mlb.name, "MLB");

  assert.equal(mlb.logoUrl, "/marks/leagues/mlb.png?v=6");

  const wnba = getLeagueIdentity("wnba");

  assert.equal(wnba.key, "WNBA");

  assert.equal(wnba.logoUrl, "/marks/leagues/wnba.png?v=6");
});

test("espnLeagueLogoUrl covers major leagues", () => {
  assert.equal(
    espnLeagueLogoUrl("MLB"),
    "https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png",
  );
  assert.equal(
    espnLeagueLogoUrl("SOCCER"),
    "https://a.espncdn.com/i/teamlogos/leagues/500/mls.png",
  );
});

test("getLeagueIdentity falls back without crashing", () => {
  const unknown = getLeagueIdentity("Quidditch");

  assert.equal(unknown.name, "Quidditch");

  assert.equal(unknown.logoUrl, undefined);

  assert.ok(leagueMarkInitials(unknown).length >= 1);
});
