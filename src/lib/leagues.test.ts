import assert from "node:assert/strict";
import test from "node:test";

import { getLeagueIdentity, leagueMarkInitials } from "@/lib/leagues";

test("getLeagueIdentity resolves seeded leagues with ESPN logos", () => {
  const mlb = getLeagueIdentity("MLB");
  assert.equal(mlb.name, "MLB");
  assert.equal(
    mlb.logoUrl,
    "https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png",
  );
  const wnba = getLeagueIdentity("wnba");
  assert.equal(wnba.key, "WNBA");
  assert.ok(wnba.logoUrl?.includes("/wnba.png"));
});

test("getLeagueIdentity falls back without crashing", () => {
  const unknown = getLeagueIdentity("Quidditch");
  assert.equal(unknown.name, "Quidditch");
  assert.equal(unknown.logoUrl, undefined);
  assert.ok(leagueMarkInitials(unknown).length >= 1);
});
