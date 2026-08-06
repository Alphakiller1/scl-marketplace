import assert from "node:assert/strict";
import { test } from "node:test";

import {
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
