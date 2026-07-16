import assert from "node:assert/strict";

import test from "node:test";

import { getLeagueIdentity, leagueMarkInitials } from "@/lib/leagues";

test("getLeagueIdentity resolves seeded leagues with self-hosted monogram marks", () => {
  const mlb = getLeagueIdentity("MLB");

  assert.equal(mlb.name, "MLB");

  assert.equal(mlb.logoUrl, "/marks/leagues/mlb.svg");

  const wnba = getLeagueIdentity("wnba");

  assert.equal(wnba.key, "WNBA");

  assert.equal(wnba.logoUrl, "/marks/leagues/wnba.svg");
});

test("getLeagueIdentity falls back without crashing", () => {
  const unknown = getLeagueIdentity("Quidditch");

  assert.equal(unknown.name, "Quidditch");

  assert.equal(unknown.logoUrl, undefined);

  assert.ok(leagueMarkInitials(unknown).length >= 1);
});
