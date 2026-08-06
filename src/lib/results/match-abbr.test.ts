import assert from "node:assert/strict";
import { test } from "node:test";

import {
  findGame,
  resolveOutcome,
  type GradablePlay,
} from "@/lib/results/match";
import type { SettledGame } from "@/lib/results/settled-game";

const game = (o: Partial<SettledGame>): SettledGame => ({
  sport: "MLB",
  eventId: "e",
  home: "Tampa Bay Rays",
  away: "Boston Red Sox",
  homeScore: 4,
  awayScore: 2,
  completed: true,
  startsAt: new Date("2026-08-05T23:10:00Z"),
  ...o,
});

const play = (o: Partial<GradablePlay>): GradablePlay => ({
  id: "p",
  sport: "MLB",
  market: "Moneyline",
  selection: "TBR -147",
  oddsAmerican: -147,
  units: 3.68,
  createdAt: new Date("2026-08-05T23:10:00Z"),
  ...o,
});

test("an abbreviated pick finds its game and grades", () => {
  const g = game({});
  assert.equal(findGame(play({}), [g])?.eventId, "e");
  assert.equal(resolveOutcome(play({}), [g]), "WIN");
  assert.equal(
    resolveOutcome(play({ selection: "SDP -117" }), [
      game({ home: "San Diego Padres", away: "Colorado Rockies" }),
    ]),
    "WIN",
  );
});

test("a handicap the parser can't read is never graded as a moneyline", () => {
  const g = game({
    home: "Houston Astros",
    away: "Texas Rangers",
    homeScore: 3,
    awayScore: 2,
  });
  // HOU won by exactly 1 — ML wins, -1 pushes. Must not claim a WIN.
  assert.equal(
    resolveOutcome(play({ market: "Custom", selection: "HOU -1 (-124)" }), [g]),
    null,
  );
});

test("a plain abbreviated moneyline is unaffected by the handicap guard", () => {
  assert.equal(resolveOutcome(play({ selection: "TBR" }), [game({})]), "WIN");
});

test("an unrelated abbreviation does not match", () => {
  assert.equal(findGame(play({ selection: "SEA -120" }), [game({})]), null);
});
