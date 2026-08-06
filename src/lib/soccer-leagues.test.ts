import assert from "node:assert/strict";
import test from "node:test";

import {
  SOCCER_LEAGUES,
  SOCCER_LEAGUE_LIMIT,
  selectSoccerLeagues,
  soccerLeagueByKey,
  type OddsApiSportRow,
} from "@/lib/soccer-leagues";

const row = (over: Partial<OddsApiSportRow>): OddsApiSportRow => ({
  group: "Soccer",
  active: true,
  has_outrights: false,
  ...over,
});

test("only in-season soccer competitions with real fixtures are selected", () => {
  const picked = selectSoccerLeagues([
    row({ key: "soccer_usa_mls", title: "MLS" }),
    row({ key: "soccer_epl", title: "EPL", active: false }), // between seasons
    row({ key: "soccer_fifa_world_cup_winner", has_outrights: true }), // futures
    row({ key: "baseball_mlb", group: "Baseball", title: "MLB" }),
    row({ key: "soccer_brazil_campeonato", title: "Brazil Série A" }),
  ]);
  assert.deepEqual(
    picked.map((l) => l.oddsApiKey),
    ["soccer_usa_mls", "soccer_brazil_campeonato"],
  );
});

test("the August case: majors are out, summer leagues carry the board", () => {
  // Early August — the exact shape that made the board look broken.
  const picked = selectSoccerLeagues([
    row({ key: "soccer_epl", active: false }),
    row({ key: "soccer_spain_la_liga", active: false }),
    row({ key: "soccer_italy_serie_a", active: false }),
    row({ key: "soccer_germany_bundesliga", active: false }),
    row({ key: "soccer_uefa_champs_league", active: false }),
    row({ key: "soccer_usa_mls", title: "MLS" }),
    row({ key: "soccer_mexico_ligamx", title: "Liga MX" }),
    row({ key: "soccer_brazil_campeonato", title: "Brazil Série A" }),
    row({
      key: "soccer_argentina_primera_division",
      title: "Primera División",
    }),
  ]);
  assert.equal(picked.length, 4);
  assert.deepEqual(
    picked.map((l) => l.label),
    ["MLS", "Liga MX", "Brasileirão", "Liga Profesional"],
  );
});

test("registry leagues take the budget first, in registry order", () => {
  const catalog = [
    row({ key: "soccer_korea_kleague1", title: "K League 1" }),
    row({ key: "soccer_usa_mls", title: "MLS" }),
    row({ key: "soccer_epl", title: "EPL" }),
  ];
  const picked = selectSoccerLeagues(catalog, 2);
  assert.deepEqual(
    picked.map((l) => l.oddsApiKey),
    ["soccer_epl", "soccer_usa_mls"],
  );
  // Unregistered competitions still make the board when there is room.
  const all = selectSoccerLeagues(catalog);
  assert.equal(all.length, 3);
  assert.equal(all[2]?.label, "K League 1");
});

test("selection is capped so one refresh can't run away with the credit budget", () => {
  const catalog = Array.from({ length: 40 }, (_, i) =>
    row({ key: `soccer_made_up_${i}`, title: `League ${i}` }),
  );
  assert.equal(selectSoccerLeagues(catalog).length, SOCCER_LEAGUE_LIMIT);
});

test("an empty or all-off-season catalog selects nothing rather than guessing", () => {
  assert.deepEqual(selectSoccerLeagues([]), []);
  assert.deepEqual(
    selectSoccerLeagues([row({ key: "soccer_epl", active: false })]),
    [],
  );
});

test("league keys resolve back to a sport key, including discovered ones", () => {
  assert.equal(soccerLeagueByKey("EPL")?.oddsApiKey, "soccer_epl");
  // A pick logged against a catalog-discovered competition must still verify
  // long after that competition drops off the board.
  assert.equal(
    soccerLeagueByKey("KOREA_KLEAGUE1")?.oddsApiKey,
    "soccer_korea_kleague1",
  );
  assert.equal(soccerLeagueByKey(""), undefined);
});

test("every registry entry uses the documented soccer_ key namespace", () => {
  for (const league of SOCCER_LEAGUES) {
    assert.ok(
      league.oddsApiKey.startsWith("soccer_"),
      `${league.key} should be a soccer_* Odds API key`,
    );
  }
});
