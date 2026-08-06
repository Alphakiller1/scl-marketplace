import assert from "node:assert/strict";
import { test } from "node:test";

import {
  findGame,
  isDeferredProp,
  resolveOutcome,
  type GradablePlay,
} from "@/lib/results/match";
import type { SettledGame } from "@/lib/results/settled-game";

/**
 * Regression cover for a live mis-grade: board-entered player props were being
 * settled against the game's combined final score.
 */

test("board-entered player props defer instead of grading as a game total", () => {
  // The exact rows that lost in production while winning in reality: the board
  // stores the display label ("Points"), and its selection text names no stat.
  const ionescu: GradablePlay = {
    id: "p1",
    sport: "WNBA",
    market: "Points",
    selection: "Sabrina Ionescu Under 19.5",
    oddsAmerican: -114,
    units: 2,
    side: "Under",
    line: 19.5,
  };
  assert.equal(isDeferredProp(ionescu), true);

  const keller: GradablePlay = {
    id: "p2",
    sport: "MLB",
    market: "Outs",
    selection: "Mitch Keller Over 15.5",
    oddsAmerican: 123,
    units: 1,
    side: "Over",
    line: 15.5,
  };
  assert.equal(isDeferredProp(keller), true);

  // Nothing may settle them off a final score, whatever the scoreline.
  const game: SettledGame = {
    sport: "WNBA",
    eventId: "e1",
    home: "New York Liberty",
    away: "Seattle Storm",
    homeScore: 92,
    awayScore: 86,
    startsAt: undefined,
    completed: true,
  };
  assert.equal(resolveOutcome(ionescu, [game]), null);
});

test("team totals are not graded as game totals", () => {
  const teamTotal: GradablePlay = {
    id: "p3",
    sport: "MLB",
    market: "Total",
    selection: "Nationals TT O4.5",
    oddsAmerican: -110,
    units: 1,
  };
  assert.equal(isDeferredProp(teamTotal), true);
});

test("real game totals still grade", () => {
  const gameTotal: GradablePlay = {
    id: "p4",
    sport: "MLB",
    market: "Total",
    selection: "Under 8.5",
    oddsAmerican: 105,
    units: 1,
    eventId: "e2",
  };
  assert.equal(isDeferredProp(gameTotal), false);
  const game: SettledGame = {
    sport: "MLB",
    eventId: "e2",
    home: "Reds",
    away: "Athletics",
    homeScore: 3,
    awayScore: 2,
    startsAt: undefined,
    completed: true,
  };
  assert.equal(resolveOutcome(gameTotal, [game]), "WIN"); // 5 < 8.5
});

test("a bare total binds to its game through the stored fixture", () => {
  // "Over 7 total" names no team, so nothing in the selection can find a game.
  // The legacy source rows carry Home/Away; carrying them through is the only
  // thing that makes such a play gradable.
  const play: GradablePlay = {
    id: "p1",
    sport: "MLB",
    market: "Custom",
    selection: "Over 7 total (-117)",
    oddsAmerican: -117,
    units: 2.34,
    homeTeam: "Milwaukee Brewers",
    awayTeam: "Pittsburgh Pirates",
    createdAt: new Date("2026-08-05T23:40:00Z"),
  };
  const games: SettledGame[] = [
    {
      sport: "MLB",
      eventId: "other",
      home: "Cincinnati Reds",
      away: "Athletics",
      homeScore: 3,
      awayScore: 2,
      completed: true,
      startsAt: new Date("2026-08-05T22:40:00Z"),
    },
    {
      sport: "MLB",
      eventId: "brewers",
      home: "Milwaukee Brewers",
      away: "Pittsburgh Pirates",
      homeScore: 5,
      awayScore: 3,
      completed: true,
      startsAt: new Date("2026-08-05T23:40:00Z"),
    },
  ];
  assert.equal(findGame(play, games)?.eventId, "brewers");
  assert.equal(resolveOutcome(play, games), "WIN"); // 8 runs > 7
});

test("Red Sox and White Sox are told apart", () => {
  // Both clubs end in "Sox", so the last-token fallback matched BOTH sides of
  // the same game and the matcher refused to pick one.
  const game: SettledGame = {
    sport: "MLB",
    eventId: "bos",
    home: "Boston Red Sox",
    away: "Chicago White Sox",
    homeScore: 6,
    awayScore: 1,
    completed: true,
    startsAt: new Date("2026-08-04T23:10:00Z"),
  };
  const play: GradablePlay = {
    id: "p2",
    sport: "MLB",
    market: "Custom",
    selection: "Red sox moneyline (-125)",
    oddsAmerican: -125,
    units: 2.5,
    createdAt: new Date("2026-08-04T23:10:00Z"),
  };
  assert.equal(resolveOutcome(play, [game]), "WIN");
  assert.equal(
    resolveOutcome({ ...play, selection: "White sox moneyline" }, [game]),
    "LOSS",
  );
});
