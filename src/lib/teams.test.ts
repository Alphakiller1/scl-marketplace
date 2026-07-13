import assert from "node:assert/strict";
import test from "node:test";

import {
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

test("getTeamIdentity creates deterministic fallback marks", () => {
  const first = getTeamIdentity("Mystery City Meteors", "MLB");
  const second = getTeamIdentity("Mystery City Meteors", "MLB");

  assert.deepEqual(first, second);
  assert.equal(first.abbr, "MCM");
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
