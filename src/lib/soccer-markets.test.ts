import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isGameLineMarket } from "@/lib/market-kind";
import { normalizeEventBoard } from "@/lib/odds-board";
import {
  expandedBoardMarkets,
  marketKeysForMarket,
  PROP_MARKET_LABEL,
} from "@/lib/odds-verify";
import { resolveOutcome } from "@/lib/results/match";
import {
  DOUBLE_CHANCE_LABEL,
  DOUBLE_CHANCE_MARKET_KEY,
  isDoubleChanceMarket,
  parseDoubleChanceSelection,
} from "@/lib/soccer-markets";

describe("parseDoubleChanceSelection", () => {
  it("reads both shapes the provider writes", () => {
    assert.deepEqual(parseDoubleChanceSelection("Crystal Palace or Draw"), {
      kind: "team-or-draw",
      team: "Crystal Palace",
    });
    // Books also write the draw first.
    assert.deepEqual(parseDoubleChanceSelection("Draw or Manchester City"), {
      kind: "team-or-draw",
      team: "Manchester City",
    });
    assert.deepEqual(
      parseDoubleChanceSelection("Crystal Palace or Manchester City"),
      { kind: "either-team", teams: ["Crystal Palace", "Manchester City"] },
    );
  });

  it("returns null for anything else, so the pick defers instead of guessing", () => {
    assert.equal(parseDoubleChanceSelection("Crystal Palace"), null);
    assert.equal(parseDoubleChanceSelection("Draw or Draw"), null);
    assert.equal(parseDoubleChanceSelection("Palace or"), null);
    assert.equal(parseDoubleChanceSelection(""), null);
  });
});

describe("double chance registration", () => {
  it("is a game line, not a player prop", () => {
    assert.equal(isGameLineMarket(DOUBLE_CHANCE_LABEL), true);
    assert.equal(isDoubleChanceMarket(DOUBLE_CHANCE_LABEL), true);
    // Exact match only — nothing else may pass as this market.
    assert.equal(isDoubleChanceMarket("Double Chance 1st Half"), false);
    assert.equal(
      Object.values(PROP_MARKET_LABEL).includes(DOUBLE_CHANCE_LABEL),
      false,
    );
  });

  it("prices against its own key and has no alternate ladder", () => {
    assert.deepEqual(marketKeysForMarket(DOUBLE_CHANCE_LABEL), [
      DOUBLE_CHANCE_MARKET_KEY,
    ]);
  });

  it("is the only market soccer's per-event call adds", () => {
    assert.deepEqual(expandedBoardMarkets("SOCCER"), [
      DOUBLE_CHANCE_MARKET_KEY,
    ]);
  });
});

describe("double chance on the board", () => {
  const event = {
    id: "evt",
    bookmakers: [
      {
        key: "draftkings",
        last_update: "2026-08-25T14:00:00Z",
        markets: [
          {
            key: DOUBLE_CHANCE_MARKET_KEY,
            outcomes: [
              { name: "Crystal Palace or Draw", price: 120 },
              { name: "Manchester City or Draw", price: -600 },
              { name: "Crystal Palace or Manchester City", price: -475 },
            ],
          },
        ],
      },
    ],
  };

  it("keeps all three combinations, with no line and the right market", () => {
    const selections = normalizeEventBoard(event, { sport: "SOCCER" });
    assert.equal(selections.length, 3);
    for (const selection of selections) {
      // The old fallthrough emitted an unlabelled Total with no line — a row
      // that renders nowhere and grades as a game total if it is ever logged.
      assert.equal(selection.market, DOUBLE_CHANCE_LABEL);
      assert.equal(selection.line, undefined);
      assert.equal(selection.selection, selection.side);
    }
    assert.deepEqual(
      selections.map((selection) => selection.selection).sort(),
      [
        "Crystal Palace or Draw",
        "Crystal Palace or Manchester City",
        "Manchester City or Draw",
      ],
    );
  });
});

describe("double chance grading", () => {
  const game = {
    sport: "SOCCER",
    home: "Crystal Palace",
    away: "Manchester City",
    homeScore: 1,
    awayScore: 1,
    completed: true,
    startsAt: new Date("2026-08-28T19:00:00Z"),
  };
  const play = (selection: string) => ({
    id: "p1",
    sport: "SOCCER",
    market: DOUBLE_CHANCE_LABEL,
    selection,
    oddsAmerican: 120,
    units: 1,
    homeTeam: "Crystal Palace",
    awayTeam: "Manchester City",
  });

  it("settles a draw as a WIN for either team-or-draw ticket", () => {
    assert.equal(resolveOutcome(play("Crystal Palace or Draw"), [game]), "WIN");
    assert.equal(
      resolveOutcome(play("Manchester City or Draw"), [game]),
      "WIN",
    );
  });

  it("settles a draw as a LOSS for the both-teams ticket", () => {
    assert.equal(
      resolveOutcome(play("Crystal Palace or Manchester City"), [game]),
      "LOSS",
    );
  });

  it("settles a decided match on the winner", () => {
    const homeWin = { ...game, homeScore: 2, awayScore: 1 };
    assert.equal(
      resolveOutcome(play("Crystal Palace or Draw"), [homeWin]),
      "WIN",
    );
    assert.equal(
      resolveOutcome(play("Manchester City or Draw"), [homeWin]),
      "LOSS",
    );
    assert.equal(
      resolveOutcome(play("Crystal Palace or Manchester City"), [homeWin]),
      "WIN",
    );
  });

  it("defers rather than guessing when the selection is not a known shape", () => {
    assert.equal(resolveOutcome(play("Palace DC"), [game]), null);
  });
});
