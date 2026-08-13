import assert from "node:assert/strict";
import { test } from "node:test";

import {
  SOCCER_LEAGUES,
  selectLeaguesWithFixtures,
  type LeagueFixtureWindow,
  type SoccerLeague,
} from "@/lib/soccer-leagues";

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 7, 13, 11, 0);

function league(oddsApiKey: string): SoccerLeague {
  return (
    SOCCER_LEAGUES.find((l) => l.oddsApiKey === oddsApiKey) ?? {
      key: oddsApiKey.replace(/^soccer_/, "").toUpperCase(),
      label: oddsApiKey,
      oddsApiKey,
    }
  );
}

function win(hoursOut: number | null, upcoming = 1): LeagueFixtureWindow {
  return hoursOut == null
    ? { upcoming: 0, firstKickoffMs: null }
    : { upcoming, firstKickoffMs: NOW + hoursOut * HOUR };
}

test("competitions playing soonest win the paid slots", () => {
  // The real 2026-08-13 shape: the prestige registry handed nine of ten slots
  // to competitions whose season had not started, while the leagues actually
  // playing that night were never fetched.
  const candidates = [
    league("soccer_epl"), // 8/21
    league("soccer_spain_la_liga"), // 8/15
    league("soccer_italy_serie_a"), // 8/22
    league("soccer_germany_bundesliga"), // 8/28
    league("soccer_usa_mls"), // 8/15
    league("soccer_japan_j_league"), // 8/14
    league("soccer_concacaf_leagues_cup"), // tonight
    league("soccer_conmebol_copa_sudamericana"), // tonight
    league("soccer_france_ligue_two"), // 8/14
  ];
  const windows = new Map<string, LeagueFixtureWindow>([
    ["soccer_epl", win(8 * 24)],
    ["soccer_spain_la_liga", win(2 * 24)],
    ["soccer_italy_serie_a", win(9 * 24)],
    ["soccer_germany_bundesliga", win(15 * 24)],
    ["soccer_usa_mls", win(2 * 24, 43)],
    ["soccer_japan_j_league", win(23, 10)],
    ["soccer_concacaf_leagues_cup", win(12, 5)],
    ["soccer_conmebol_copa_sudamericana", win(11, 3)],
    ["soccer_france_ligue_two", win(31, 9)],
  ]);

  const picked = selectLeaguesWithFixtures(candidates, windows, 4, NOW).map(
    (l) => l.oddsApiKey,
  );
  // Same rolling day (all inside 24h) -> ordered by how many fixtures each
  // offers, so a full matchday outranks a lone early kickoff.
  assert.deepEqual(picked, [
    "soccer_japan_j_league",
    "soccer_concacaf_leagues_cup",
    "soccer_conmebol_copa_sudamericana",
    "soccer_france_ligue_two",
  ]);
  // The whole point: a competition 8 days out must not outrank tonight's match
  // just because it is famous.
  assert.ok(!picked.includes("soccer_epl"));
});

test("a competition with no fixture in the window never outranks one that has", () => {
  const candidates = [league("soccer_epl"), league("soccer_japan_j_league")];
  const windows = new Map<string, LeagueFixtureWindow>([
    // In season, but nothing scheduled inside the lookahead.
    ["soccer_epl", { upcoming: 0, firstKickoffMs: NOW + 8 * 24 * HOUR }],
    ["soccer_japan_j_league", win(23, 10)],
  ]);
  assert.deepEqual(
    selectLeaguesWithFixtures(candidates, windows, 1, NOW).map(
      (l) => l.oddsApiKey,
    ),
    ["soccer_japan_j_league"],
  );
});

test("idle competitions still fill leftover slots, in registry order", () => {
  // A quiet midweek must not shrink the board — the budget is still spent, just
  // on the majors, which is the old behaviour and the right fallback.
  const candidates = [
    league("soccer_italy_serie_a"),
    league("soccer_epl"),
    league("soccer_japan_j_league"),
  ];
  const windows = new Map<string, LeagueFixtureWindow>([
    ["soccer_japan_j_league", win(5, 2)],
  ]);
  assert.deepEqual(
    selectLeaguesWithFixtures(candidates, windows, 3, NOW).map(
      (l) => l.oddsApiKey,
    ),
    ["soccer_japan_j_league", "soccer_epl", "soccer_italy_serie_a"],
  );
});

test("an unprobed competition degrades to idle, never to excluded", () => {
  // A failed probe writes no window. That must cost ordering, not coverage.
  const candidates = [league("soccer_epl"), league("soccer_japan_j_league")];
  const picked = selectLeaguesWithFixtures(candidates, new Map(), 2, NOW);
  assert.equal(picked.length, 2);
});

test("same day and same volume falls back to registry prestige", () => {
  const candidates = [league("soccer_japan_j_league"), league("soccer_epl")];
  const windows = new Map<string, LeagueFixtureWindow>([
    ["soccer_japan_j_league", win(6, 4)],
    ["soccer_epl", win(6, 4)],
  ]);
  assert.deepEqual(
    selectLeaguesWithFixtures(candidates, windows, 1, NOW).map(
      (l) => l.oddsApiKey,
    ),
    ["soccer_epl"],
  );
});

test("tonight outranks a bigger matchday tomorrow", () => {
  // Day beats volume: a capper betting now needs tonight's card, even if
  // tomorrow's is larger.
  const candidates = [
    league("soccer_efl_champ"),
    league("soccer_concacaf_leagues_cup"),
  ];
  const windows = new Map<string, LeagueFixtureWindow>([
    ["soccer_efl_champ", win(30, 9)],
    ["soccer_concacaf_leagues_cup", win(12, 2)],
  ]);
  assert.deepEqual(
    selectLeaguesWithFixtures(candidates, windows, 1, NOW).map(
      (l) => l.oddsApiKey,
    ),
    ["soccer_concacaf_leagues_cup"],
  );
});

test("the limit is respected and never negative", () => {
  const candidates = SOCCER_LEAGUES.slice(0, 5);
  assert.equal(
    selectLeaguesWithFixtures(candidates, new Map(), 3, NOW).length,
    3,
  );
  assert.equal(
    selectLeaguesWithFixtures(candidates, new Map(), 0, NOW).length,
    0,
  );
  assert.equal(
    selectLeaguesWithFixtures(candidates, new Map(), -1, NOW).length,
    0,
  );
});
