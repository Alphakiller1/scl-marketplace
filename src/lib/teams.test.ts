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

test("NCAAF identities use ESPN college logos", () => {
  const ucla = getTeamIdentity("UCLA Bruins", "NCAAF");
  assert.equal(ucla.abbr, "UCLA");
  assert.equal(
    ucla.logoUrl,
    "https://a.espncdn.com/i/teamlogos/ncaa/500/26.png",
  );
  assert.equal(getTeamIdentity("UCLA", "NCAAF").abbr, "UCLA");
  assert.equal(getTeamIdentity("#8 UCLA Bruins", "ncaaf").abbr, "UCLA");
  assert.equal(
    getTeamIdentity("#18 Purdue Boilermakers", "NCAAF").logoUrl,
    "https://a.espncdn.com/i/teamlogos/ncaa/500/2509.png",
  );
  const purdue = getTeamIdentity("Purdue Boilermakers", "NCAAF");
  assert.equal(purdue.abbr, "PUR");
  assert.equal(
    purdue.logoUrl,
    "https://a.espncdn.com/i/teamlogos/ncaa/500/2509.png",
  );
  assert.equal(
    getTeamIdentity("Purdue", "NCAAF").fullName,
    "Purdue Boilermakers",
  );
  assert.equal(resolveKnownTeam("Purdue Boilermakers", "NCAAF")?.abbr, "PUR");
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

test("NCAAB board labels use schools instead of mascots without changing the team identity", () => {
  for (const [name, school] of [
    ["Duke Blue Devils", "Duke"],
    ["North Carolina Tar Heels", "North Carolina"],
    ["Kentucky Wildcats", "Kentucky"],
    ["Gonzaga Bulldogs", "Gonzaga"],
    ["Georgia Bulldogs", "Georgia"],
    ["UConn Huskies", "UConn"],
    ["Washington Huskies", "Washington"],
    ["Miami Hurricanes", "Miami"],
    ["Miami (OH) RedHawks", "Miami (OH)"],
    ["Loyola Maryland Greyhounds", "Loyola Maryland"],
    ["Loyola Marymount Lions", "Loyola Marymount"],
    ["Boston University Terriers", "Boston University"],
  ]) {
    const identity = getTeamIdentity(name, "NCAAB");
    assert.equal(identity.shortName, school, name);
    assert.equal(
      identity.fullName,
      name,
      "the stored team identity remains unchanged",
    );
  }
});

test("college school labels accept feed aliases and ranks while unknown names stay whole", () => {
  for (const [name, school] of [
    ["#8 Duke Blue Devils", "Duke"],
    ["18. North Carolina Tar Heels", "North Carolina"],
    ["Connecticut Huskies", "UConn"],
    ["Appalachian St Mountaineers", "App State"],
    ["San Jose St Spartans", "San José State"],
    ["Fort Wayne Mastodons", "Purdue Fort Wayne"],
    ["Cal Baptist Lancers", "California Baptist"],
    ["Central Connecticut St Blue Devils", "Central Connecticut"],
    ["IUPUI Jaguars", "IU Indianapolis"],
    ["Tenn-Martin Skyhawks", "UT Martin"],
    ["Texas A&M-CC Islanders", "Texas A&M-Corpus Christi"],
    ["Loyola (Chi) Ramblers", "Loyola Chicago"],
    ["Duke", "Duke"],
    ["Unknown University Panthers", "Unknown University Panthers"],
  ]) {
    assert.equal(getTeamIdentity(name, " ncaab ").shortName, school, name);
  }
  assert.equal(resolveKnownTeam("Bulldogs", "NCAAB"), null);
  assert.equal(
    getTeamIdentity("Mystery City Meteors", "NBA").shortName,
    "Meteors",
  );
});

test("readableTextColor chooses a contrasting text color", () => {
  assert.equal(readableTextColor("#ffffff"), "#0b0f19");
  assert.equal(readableTextColor("#000000"), "#ffffff");
});

test("accents never split a club from its plain spelling", () => {
  // The registry stores "San José State Spartans"; feeds also write it plain.
  // The key used to strip the é outright, so the two spellings never met.
  const accented = resolveKnownTeam("San José State Spartans", "NCAAF");
  assert.ok(accented);
  assert.equal(
    resolveKnownTeam("San Jose State Spartans", "NCAAF")?.key,
    accented.key,
  );
});
