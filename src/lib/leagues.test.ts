import assert from "node:assert/strict";

import test from "node:test";

import { getLeagueIdentity, leagueMarkInitials } from "@/lib/leagues";

test("getLeagueIdentity resolves seeded leagues without remote logos by default", () => {
  const mlb = getLeagueIdentity("MLB");

  assert.equal(mlb.name, "MLB");

  assert.equal(mlb.logoUrl, undefined);

  const wnba = getLeagueIdentity("wnba");

  assert.equal(wnba.key, "WNBA");

  assert.equal(wnba.logoUrl, undefined);
});

test("getLeagueIdentity falls back without crashing", () => {
  const unknown = getLeagueIdentity("Quidditch");

  assert.equal(unknown.name, "Quidditch");

  assert.equal(unknown.logoUrl, undefined);

  assert.ok(leagueMarkInitials(unknown).length >= 1);
});
