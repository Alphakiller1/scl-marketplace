import assert from "node:assert/strict";
import test from "node:test";

import {
  espnTeamLogoUrl,
  getTeamIdentity,
  readableTextColor,
  resolveKnownTeam,
} from "@/lib/teams";

test("getTeamIdentity resolves mapped teams and aliases", () => {
  assert.equal(getTeamIdentity("Los Angeles Sparks", "WNBA").abbr, "LAS");
  assert.equal(
    getTeamIdentity("LA Dodgers", "MLB").fullName,
    "Los Angeles Dodgers",
  );
  assert.equal(getTeamIdentity("Oakland Athletics", "MLB").abbr, "ATH");
});

test("seeded MLB/WNBA teams use ESPN CDN logos", () => {
  const dodgers = getTeamIdentity("Los Angeles Dodgers", "MLB");
  assert.equal(
    dodgers.logoUrl,
    "https://a.espncdn.com/i/teamlogos/mlb/500/lad.png",
  );
  const sparks = getTeamIdentity("Los Angeles Sparks", "WNBA");
  assert.equal(
    sparks.logoUrl,
    "https://a.espncdn.com/i/teamlogos/wnba/500/la.png",
  );
  const whiteSox = getTeamIdentity("Chicago White Sox", "MLB");
  assert.equal(
    whiteSox.logoUrl,
    "https://a.espncdn.com/i/teamlogos/mlb/500/chw.png",
  );
});

test("all NFL teams resolve to self-hosted logo assets", () => {
  for (const name of [
    "Detroit Lions",
    "Green Bay Packers",
    "Pittsburgh Steelers",
    "New England Patriots",
    "Las Vegas Raiders",
    "San Francisco 49ers",
  ]) {
    const identity = getTeamIdentity(name, "NFL");
    assert.match(identity.logoUrl ?? "", /^\/marks\/teams\/nfl\/[a-z]+\.png/);
  }
});

test("espnTeamLogoUrl applies abbr overrides", () => {
  assert.equal(
    espnTeamLogoUrl("MLB", "CWS"),
    "https://a.espncdn.com/i/teamlogos/mlb/500/chw.png",
  );
});

test("getTeamIdentity creates deterministic fallback marks without logos", () => {
  const first = getTeamIdentity("Mystery City Meteors", "MLB");
  const second = getTeamIdentity("Mystery City Meteors", "MLB");

  assert.deepEqual(first, second);
  assert.equal(first.abbr, "MCM");
  assert.equal(first.logoUrl, undefined);
});

test("resolveKnownTeam returns null for unknown names", () => {
  assert.equal(resolveKnownTeam("LA Dodgers", "MLB")?.abbr, "LAD");
  assert.equal(resolveKnownTeam("Mystery City Meteors", "MLB"), null);
  assert.equal(resolveKnownTeam("Los Angeles Dodgers", "WNBA"), null);
});

test("readableTextColor chooses a contrasting text color", () => {
  assert.equal(readableTextColor("#ffffff"), "#0b0f19");
  assert.equal(readableTextColor("#000000"), "#ffffff");
});
