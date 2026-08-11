import assert from "node:assert/strict";
import test from "node:test";

import { espnSoccerLeagueSlug } from "@/lib/results/espn-soccer-leagues";

test("maps curated SCL soccer leagues to ESPN scoreboard slugs", () => {
  assert.equal(espnSoccerLeagueSlug("EPL"), "eng.1");
  assert.equal(espnSoccerLeagueSlug("MLS"), "usa.1");
  assert.equal(espnSoccerLeagueSlug("BRAZIL_SERIE_A"), "bra.1");
  assert.equal(espnSoccerLeagueSlug("UCL"), "uefa.champions");
});

test("maps catalog-derived Odds API league tags", () => {
  assert.equal(espnSoccerLeagueSlug("usa_mls"), "usa.1");
  assert.equal(espnSoccerLeagueSlug("mexico-ligamx"), "mex.1");
  assert.equal(espnSoccerLeagueSlug("efl_champ"), "eng.2");
});

test("unknown or missing leagues fail closed", () => {
  assert.equal(espnSoccerLeagueSlug("UNKNOWN_CUP"), null);
  assert.equal(espnSoccerLeagueSlug(null), null);
});
