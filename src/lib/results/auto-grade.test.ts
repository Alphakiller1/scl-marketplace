import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveOutcome, type GradablePlay } from "@/lib/results/match";
import type { SettledGame } from "@/lib/results/provider";

const GAMES: SettledGame[] = [
  {
    sport: "basketball_nba",
    home: "Boston Celtics",
    away: "Los Angeles Lakers",
    homeScore: 118,
    awayScore: 104,
    completed: true,
  },
  {
    sport: "baseball_mlb",
    home: "New York Yankees",
    away: "Boston Red Sox",
    homeScore: 3,
    awayScore: 7,
    completed: true,
  },
];

function play(p: Partial<GradablePlay>): GradablePlay {
  return {
    id: "p",
    sport: "basketball_nba",
    market: "Moneyline",
    selection: "Celtics",
    oddsAmerican: -110,
    units: 1,
    ...p,
  };
}

test("moneyline: winning team → WIN, losing team → LOSS", () => {
  assert.equal(resolveOutcome(play({ selection: "Celtics" }), GAMES), "WIN");
  assert.equal(resolveOutcome(play({ selection: "Lakers" }), GAMES), "LOSS");
});

test("moneyline resolves the correct sport's game", () => {
  const p = play({ sport: "baseball_mlb", market: "ML", selection: "Red Sox" });
  assert.equal(resolveOutcome(p, GAMES), "WIN"); // Red Sox 7 > Yankees 3
});

test("totals: over/under vs the combined score, with push on the number", () => {
  const base = { sport: "basketball_nba", market: "Celtics/Lakers Total" };
  assert.equal(
    resolveOutcome(play({ ...base, selection: "Over 210.5" }), GAMES),
    "WIN",
  ); // 222 > 210.5
  assert.equal(
    resolveOutcome(play({ ...base, selection: "Under 210.5" }), GAMES),
    "LOSS",
  );
  assert.equal(
    resolveOutcome(play({ ...base, selection: "Over 222" }), GAMES),
    "PUSH",
  ); // exactly 222
});

test("unmatched / ambiguous plays return null (stay pending)", () => {
  assert.equal(resolveOutcome(play({ selection: "Warriors" }), GAMES), null); // no such game
  assert.equal(
    resolveOutcome(
      play({ market: "Player Props", selection: "Tatum over 25.5 pts" }),
      GAMES,
    ),
    null,
  );
});
