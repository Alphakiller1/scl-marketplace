import assert from "node:assert/strict";
import { test } from "node:test";

import {
  findPlayer,
  normalizeName,
  playerNameFromSelection,
  resolvePlayerProp,
  statKeyForMarket,
  type PlayerBoxScore,
} from "@/lib/results/player-props";
import {
  inningsToOuts,
  mapSummaryToPlayerBox,
} from "@/lib/results/stats-provider";

/**
 * These cases are the real plays that sat PENDING in production on 2026-08-06
 * because player props had no resolver at all. The numbers are the actual ESPN
 * box-score values, so a regression here means a capper gets mis-graded.
 */

const box: PlayerBoxScore = {
  players: [
    {
      name: "Michael Wacha",
      team: "Kansas City Royals",
      played: true,
      stats: { strikeouts: 1, outs: 17 },
    },
    {
      name: "Cristopher Sanchez",
      team: "Philadelphia Phillies",
      played: true,
      stats: { strikeouts: 6, outs: 15 },
    },
    {
      name: "Ranger Suarez",
      team: "Boston Red Sox",
      played: true,
      stats: { strikeouts: 2, outs: 9 },
    },
    {
      name: "Sophie Cunningham",
      team: "Indiana Fever",
      played: true,
      stats: { points: 2 },
    },
    {
      name: "Bridget Carleton",
      team: "Portland Fire",
      played: true,
      stats: { points: 10 },
    },
    {
      name: "Chloe Bibby",
      team: "Minnesota Lynx",
      played: false,
      stats: {},
    },
  ],
};

test("the props that stalled production now settle from the box score", () => {
  // Wacha struck out 1; the capper needed more than 4.5.
  assert.equal(
    resolvePlayerProp(
      {
        market: "Strikeouts",
        selection: "Michael Wacha Over 4.5",
        side: "Over",
        line: 4.5,
      },
      box,
    ),
    "LOSS",
  );

  // Sanchez went 5.0 IP = 15 outs, under 18.5.
  assert.equal(
    resolvePlayerProp(
      {
        market: "Outs",
        selection: "Cristopher Sanchez Under 18.5",
        side: "Under",
        line: 18.5,
      },
      box,
    ),
    "WIN",
  );

  // Suarez had been traded to Boston — the resolver must not care what team
  // anyone remembers him on, only that the box score names him.
  assert.equal(
    resolvePlayerProp(
      {
        market: "Outs",
        selection: "Ranger Suarez Under 15.5",
        side: "Under",
        line: 15.5,
      },
      box,
    ),
    "WIN",
  );

  assert.equal(
    resolvePlayerProp(
      {
        market: "Points",
        selection: "Sophie Cunningham Over 9.5",
        side: "Over",
        line: 9.5,
      },
      box,
    ),
    "LOSS",
  );

  assert.equal(
    resolvePlayerProp(
      {
        market: "Points",
        selection: "Bridget Carleton Over 16.5",
        side: "Over",
        line: 16.5,
      },
      box,
    ),
    "LOSS",
  );
});

test("a player who did not appear voids rather than losing", () => {
  assert.equal(
    resolvePlayerProp(
      {
        market: "Points",
        selection: "Chloe Bibby Over 4.5",
        side: "Over",
        line: 4.5,
      },
      box,
    ),
    "VOID",
  );
});

test("an exact line is a push", () => {
  assert.equal(
    resolvePlayerProp(
      {
        market: "Outs",
        selection: "Cristopher Sanchez Under 15",
        side: "Under",
        line: 15,
      },
      box,
    ),
    "PUSH",
  );
});

test("anything uncertain defers instead of guessing", () => {
  // Unknown market.
  assert.equal(
    resolvePlayerProp(
      { market: "Doubles", selection: "Michael Wacha Over 1.5", line: 1.5 },
      box,
    ),
    null,
  );
  // Player not in this game.
  assert.equal(
    resolvePlayerProp(
      { market: "Points", selection: "Caitlin Clark Over 20.5", line: 20.5 },
      box,
    ),
    null,
  );
  // No line to compare against.
  assert.equal(
    resolvePlayerProp(
      { market: "Points", selection: "Sophie Cunningham Over", line: null },
      box,
    ),
    null,
  );
  // Stat absent for that athlete (a pitcher has no points).
  assert.equal(
    resolvePlayerProp(
      { market: "Points", selection: "Michael Wacha Over 1.5", line: 1.5 },
      box,
    ),
    null,
  );
});

test("two players sharing a surname are never guessed between", () => {
  const twoSuarez: PlayerBoxScore = {
    players: [
      { name: "Ranger Suarez", team: "BOS", played: true, stats: { outs: 9 } },
      { name: "Albert Suarez", team: "BAL", played: true, stats: { outs: 6 } },
    ],
  };
  assert.equal(findPlayer(twoSuarez, "Suarez"), "AMBIGUOUS");
  // The full name still resolves.
  assert.equal(
    (findPlayer(twoSuarez, "Ranger Suarez") as { name: string }).name,
    "Ranger Suarez",
  );
});

test("names match across accents and suffixes", () => {
  assert.equal(normalizeName("Cristopher Sánchez"), "cristopher sanchez");
  assert.equal(normalizeName("Michael Wacha Jr."), "michael wacha");
});

test("the player name is read off the front of the selection", () => {
  assert.equal(
    playerNameFromSelection("Michael Wacha Over 4.5"),
    "Michael Wacha",
  );
  assert.equal(
    playerNameFromSelection("Sabrina Ionescu Under 19.5"),
    "Sabrina Ionescu",
  );
  // Not a player prop — must not be mistaken for one.
  assert.equal(playerNameFromSelection("Under 8.5"), null);
});

test("market labels map to the stat the board writes", () => {
  assert.equal(statKeyForMarket("Points"), "points");
  assert.equal(statKeyForMarket("Outs"), "outs");
  assert.equal(statKeyForMarket("Strikeouts"), "strikeouts");
  assert.equal(statKeyForMarket("Total"), null);
  assert.equal(statKeyForMarket(null), null);
});

test("innings pitched convert to outs in thirds", () => {
  assert.equal(inningsToOuts("5.0"), 15);
  assert.equal(inningsToOuts("5.2"), 17);
  assert.equal(inningsToOuts("0.1"), 1);
  assert.equal(inningsToOuts("6"), 18);
  // A fourth third is not a real value.
  assert.equal(inningsToOuts("5.3"), null);
});

test("ESPN summary JSON maps to stat lines, keeping pitching and batting apart", () => {
  const summary = {
    boxscore: {
      players: [
        {
          team: { displayName: "Kansas City Royals" },
          statistics: [
            {
              type: "batting",
              labels: ["AB", "R", "H", "RBI"],
              athletes: [
                {
                  athlete: { displayName: "Bobby Witt Jr." },
                  stats: ["4", "1", "2", "1"],
                },
              ],
            },
            {
              type: "pitching",
              labels: ["IP", "H", "R", "ER", "BB", "K"],
              athletes: [
                {
                  athlete: { displayName: "Michael Wacha" },
                  stats: ["5.2", "6", "3", "3", "1", "1"],
                },
                // Inactive players arrive with an empty stat array.
                { athlete: { displayName: "Bench Arm" }, stats: [] },
              ],
            },
          ],
        },
      ],
    },
  };

  const mapped = mapSummaryToPlayerBox(summary);
  assert.ok(mapped);
  const wacha = mapped.players.find((p) => p.name === "Michael Wacha");
  assert.deepEqual(wacha?.stats, { outs: 17, strikeouts: 1, earnedRuns: 3 });
  assert.equal(wacha?.played, true);

  // "H" on the batting line is hits; it must not become a pitching stat.
  const witt = mapped.players.find((p) => p.name === "Bobby Witt Jr.");
  assert.equal(witt?.stats.hits, 2);

  assert.equal(
    mapped.players.find((p) => p.name === "Bench Arm")?.played,
    false,
  );
});

test("basketball three-pointers read the made half of made-attempted", () => {
  const summary = {
    boxscore: {
      players: [
        {
          team: { displayName: "Indiana Fever" },
          statistics: [
            {
              type: "",
              labels: ["MIN", "3PT", "REB", "AST", "PTS"],
              athletes: [
                {
                  athlete: { displayName: "Sophie Cunningham" },
                  stats: ["28", "0-4", "3", "2", "2"],
                },
              ],
            },
          ],
        },
      ],
    },
  };
  const mapped = mapSummaryToPlayerBox(summary);
  const p = mapped?.players[0];
  assert.equal(p?.stats.points, 2);
  assert.equal(p?.stats.threes, 0);
  assert.equal(p?.stats.rebounds, 3);
  assert.equal(p?.stats.assists, 2);
});
