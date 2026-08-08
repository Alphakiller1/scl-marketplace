import assert from "node:assert/strict";
import { test } from "node:test";

import { espnIdOf, mergeSettledGames } from "@/lib/results/settled-game";
import { findGame, type GradablePlay } from "@/lib/results/match";
import type { SettledGame } from "@/lib/results/settled-game";

const game = (over: Partial<SettledGame>): SettledGame => ({
  sport: "MLB",
  home: "Cincinnati Reds",
  away: "Athletics",
  homeScore: 3,
  awayScore: 2,
  completed: true,
  startsAt: new Date("2026-08-05T22:40:00Z"),
  ...over,
});

test("the same fixture from both providers collapses to one", () => {
  // The Odds API issues a hash, ESPN a numeric id. Keying on eventId meant
  // neither ever matched the other and every game appeared twice.
  const oddsApi = game({ eventId: "3b23ade05c9d38068df5e7af422bca05" });
  const espn = game({ eventId: "401816405" });

  const merged = mergeSettledGames([oddsApi], [espn]);
  assert.equal(merged.length, 1);
  // Primary wins: it carries the id that event-bound plays match on.
  assert.equal(merged[0]!.eventId, "3b23ade05c9d38068df5e7af422bca05");
});

test("the winning copy keeps the ESPN id box-score grading needs", () => {
  // Losing this id is what stopped EVERY player prop and every F3/F5/F7 segment
  // grading: those settle from ESPN's summary endpoint, which only accepts
  // ESPN's numeric id, and the Odds API copy — which wins any fixture inside
  // its 3-day scores window — carries a hash. The grader found no ESPN id on
  // the merged game and deferred the play on every single run, forever.
  const oddsApi = game({ eventId: "3b23ade05c9d38068df5e7af422bca05" });
  const espn = game({ eventId: "espn:401816405", espnEventId: "401816405" });

  const merged = mergeSettledGames([oddsApi], [espn]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]!.eventId, "3b23ade05c9d38068df5e7af422bca05");
  assert.equal(merged[0]!.espnEventId, "401816405");
  assert.equal(espnIdOf(merged[0]!), "401816405");
});

test("espnIdOf reads both shapes, and reports none when there is none", () => {
  assert.equal(espnIdOf(game({ eventId: "espn:401816405" })), "401816405");
  assert.equal(espnIdOf(game({ espnEventId: "401816405" })), "401816405");
  // An Odds API hash is not an ESPN id — passing it to the summary endpoint
  // 404s, so it must read as absent rather than be tried.
  assert.equal(espnIdOf(game({ eventId: "3b23ade05c9d38" })), null);
  assert.equal(espnIdOf(game({})), null);
});

test("a fixture only the Odds API has stays without an ESPN id", () => {
  const merged = mergeSettledGames([game({ eventId: "odds-only" })], []);
  assert.equal(merged[0]!.espnEventId, undefined);
});

test("a duplicated fixture no longer makes every name match ambiguous", () => {
  const merged = mergeSettledGames(
    [game({ eventId: "odds-api-hash" })],
    [game({ eventId: "espn-numeric" })],
  );
  // An imported legacy pick carries no eventId and is matched by name.
  const play: GradablePlay = {
    id: "p1",
    sport: "MLB",
    market: "Moneyline",
    selection: "Cincinnati Reds",
    oddsAmerican: -150,
    units: 1,
    createdAt: new Date("2026-08-05T22:40:00Z"),
  };
  assert.equal(findGame(play, merged)?.eventId, "odds-api-hash");
});

test("the backstop's copy survives when only it has the game", () => {
  const espnOnly = game({ eventId: "401816405" });
  const merged = mergeSettledGames([], [espnOnly]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]!.eventId, "401816405");
});

test("genuinely different fixtures are kept apart", () => {
  const monday = game({
    eventId: "a",
    startsAt: new Date("2026-08-04T22:40:00Z"),
  });
  const tuesday = game({
    eventId: "b",
    startsAt: new Date("2026-08-05T22:40:00Z"),
  });
  const other = game({
    eventId: "c",
    home: "Chicago Cubs",
    away: "Los Angeles Dodgers",
  });
  assert.equal(mergeSettledGames([monday, tuesday, other], []).length, 3);
});

test("consecutive games of a series are not collapsed by the UTC date", () => {
  // An 8:05pm ET first pitch is 00:05Z the NEXT day, so keying on the calendar
  // date put Monday's late game and Tuesday's afternoon game in the same
  // bucket. One survived, the other vanished, and every play on the missing
  // fixture went unmatched.
  const monday = game({
    eventId: "mon",
    home: "Chicago Cubs",
    away: "Los Angeles Dodgers",
    startsAt: new Date("2026-08-05T00:05:00Z"),
  });
  const tuesday = game({
    eventId: "tue",
    home: "Chicago Cubs",
    away: "Los Angeles Dodgers",
    startsAt: new Date("2026-08-05T18:20:00Z"),
  });

  const merged = mergeSettledGames([monday, tuesday], []);
  assert.equal(merged.length, 2);

  // A play on the late game must find the late game, not the next day's.
  const play: GradablePlay = {
    id: "p",
    sport: "MLB",
    market: "Moneyline",
    selection: "Los Angeles Dodgers",
    oddsAmerican: -164,
    units: 8.2,
    createdAt: new Date("2026-08-05T00:05:00Z"),
  };
  assert.equal(findGame(play, merged)?.eventId, "mon");
});

test("providers disagreeing by minutes still dedupe", () => {
  const a = game({
    eventId: "odds",
    startsAt: new Date("2026-08-05T22:59:00Z"),
  });
  const b = game({
    eventId: "espn",
    startsAt: new Date("2026-08-05T23:01:00Z"),
  });
  assert.equal(mergeSettledGames([a], [b]).length, 1);
});

test("a doubleheader stays two fixtures", () => {
  const g1 = game({
    eventId: "g1",
    startsAt: new Date("2026-08-05T17:00:00Z"),
  });
  const g2 = game({
    eventId: "g2",
    startsAt: new Date("2026-08-05T20:00:00Z"),
  });
  assert.equal(mergeSettledGames([g1, g2], []).length, 2);
});
