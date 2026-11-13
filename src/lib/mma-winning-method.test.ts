import assert from "node:assert/strict";
import test from "node:test";

import { espnMmaWinningMethodRows } from "@/lib/espn-mma-odds";
import { isGameLineMarket } from "@/lib/market-kind";
import { espnMmaFinish, MMA_WINNING_METHOD } from "@/lib/mma-winning-method";
import { matchesBoardSelection } from "@/lib/odds-board";
import { selectionAllowedForMarkets } from "@/lib/odds-control";
import { resolveOutcome, type GradablePlay } from "@/lib/results/match";
import { type SettledGame } from "@/lib/results/settled-game";
import { findConflict, findInternalParlayConflicts } from "@/lib/slip";

test("DraftKings method lines use athlete IDs and verify the fighter, method and book", () => {
  const rows = espnMmaWinningMethodRows(
    {
      provider: { id: "100" },
      homeAthleteOdds: {
        athlete: {
          $ref: "https://sports.core.api.espn.com/v2/sports/mma/athletes/4426000?lang=en",
        },
        current: {
          victoryMethod: {
            koTkoDq: { american: "+110" },
            submission: { american: "+1000" },
            points: { american: "+380" },
          },
        },
      },
      awayAthleteOdds: {
        athlete: {
          $ref: "https://sports.core.api.espn.com/v2/sports/mma/athletes/4049391",
        },
        current: {
          victoryMethod: {
            koTkoDq: { american: "+450" },
            submission: { american: "-" },
          },
        },
      },
    },
    new Map([
      ["4049391", "Josh Hokit"],
      ["4426000", "Ciryl Gane"],
    ]),
  );
  assert.deepEqual(
    rows.map(({ selection, oddsAmerican }) => [selection, oddsAmerican]),
    [
      ["Ciryl Gane by KO/TKO/DQ", 110],
      ["Ciryl Gane by Submission", 1000],
      ["Ciryl Gane by Decision", 380],
      ["Josh Hokit by KO/TKO/DQ", 450],
    ],
  );
  const [row, opposite] = [rows[0]!, rows[3]!];
  assert.equal(isGameLineMarket(row.market), true);
  assert.equal(selectionAllowedForMarkets(row, ["h2h"]), true);
  assert.equal(selectionAllowedForMarkets(row, ["totals"]), false);
  assert.equal(matchesBoardSelection(row, row), true);
  assert.equal(
    matchesBoardSelection(row, { ...row, selection: opposite.selection }),
    false,
  );
  assert.equal(matchesBoardSelection(row, { ...row, book: "fanduel" }), false);
});

test("winning method grades only on the matching final bout and confirmed finish", () => {
  const startsAt = new Date("2026-11-15T02:00:00Z");
  const official: SettledGame = {
    sport: "MMA",
    home: "José Souza",
    away: "Jonny Parsons",
    homeScore: 1,
    awayScore: 0,
    completed: true,
    eventId: "espn:401928118",
    startsAt,
    mmaFinish: espnMmaFinish("kotko"),
  };
  const board: SettledGame = {
    ...official,
    home: official.away,
    away: official.home,
    homeScore: 0,
    awayScore: 1,
    eventId: "mma-bout",
    mmaFinish: undefined,
  };
  const pick: GradablePlay = {
    id: "pick",
    sport: "MMA",
    eventId: board.eventId,
    eventStartsAt: startsAt,
    market: MMA_WINNING_METHOD,
    selection: "Jose Souza by KO/TKO/DQ",
    oddsAmerican: 120,
    units: 1,
  };
  assert.equal(resolveOutcome(pick, [board]), null);
  assert.equal(resolveOutcome(pick, [board, official]), "WIN");
  assert.equal(
    resolveOutcome({ ...pick, selection: "Jose Souza by Decision" }, [
      board,
      official,
    ]),
    "LOSS",
  );
  assert.equal(
    resolveOutcome({ ...pick, selection: "Jonny Parsons by KO/TKO/DQ" }, [
      board,
      official,
    ]),
    "LOSS",
  );
  assert.equal(
    resolveOutcome(pick, [board, { ...official, away: "Different opponent" }]),
    null,
  );
  assert.equal(
    resolveOutcome(pick, [board, { ...official, homeScore: 0, awayScore: 1 }]),
    null,
  );
  assert.equal(
    resolveOutcome(pick, [board, { ...official, mmaFinish: "noContest" }]),
    "VOID",
  );
  assert.equal(
    resolveOutcome(pick, [
      { ...board, awayScore: 0 },
      { ...official, mmaFinish: "draw", homeScore: 0 },
    ]),
    "LOSS",
  );
  assert.equal(espnMmaFinish("decision---unanimous"), "points");
  assert.equal(espnMmaFinish("technical-submission"), "submission");
  assert.equal(espnMmaFinish("technical-draw"), "draw");
  assert.equal(espnMmaFinish("unknown"), undefined);
});

test("winning method parlays can combine different fights", () => {
  const method = {
    eventId: "bout",
    market: MMA_WINNING_METHOD,
    side: "Ciryl Gane by Decision",
    oddsAmerican: 380,
  };
  const moneyline = {
    eventId: "bout",
    market: "Moneyline",
    side: "Ciryl Gane",
    oddsAmerican: -225,
  };
  assert.equal(findConflict([moneyline], method)?.kind, "mma_winning_method");
  assert.equal(findInternalParlayConflicts([method, moneyline]).length, 1);
  assert.equal(
    findConflict([moneyline], { ...method, eventId: "another-bout" }),
    null,
  );
});
