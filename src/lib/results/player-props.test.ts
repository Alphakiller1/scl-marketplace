import assert from "node:assert/strict";
import { test } from "node:test";

import {
  findPlayer,
  normalizeName,
  playerNameFromSelection,
  playerPropCandidateEventIds,
  resolvePlayerProp,
  statKeyForMarket,
  type PlayerBoxScore,
} from "@/lib/results/player-props";
import {
  inningsToOuts,
  mapSummaryToPlayerBox,
} from "@/lib/results/stats-provider";

test("legacy player props inspect only nearby settled ESPN events", () => {
  const startsAt = new Date("2026-08-10T23:00:00Z");
  const games = [
    {
      sport: "MLB",
      home: "Tigers",
      away: "White Sox",
      homeScore: 2,
      awayScore: 1,
      completed: true,
      espnEventId: "nearby",
      startsAt: new Date("2026-08-10T23:05:00Z"),
    },
    // A duplicate provider copy must not cause false ambiguity.
    {
      sport: "MLB",
      home: "Tigers",
      away: "White Sox",
      homeScore: 2,
      awayScore: 1,
      completed: true,
      eventId: "espn:nearby",
      startsAt: new Date("2026-08-10T23:05:00Z"),
    },
    {
      sport: "MLB",
      home: "Mets",
      away: "Braves",
      homeScore: 3,
      awayScore: 4,
      completed: true,
      espnEventId: "too-late",
      startsAt: new Date("2026-08-11T01:00:01Z"),
    },
    {
      sport: "WNBA",
      home: "Liberty",
      away: "Fever",
      homeScore: 80,
      awayScore: 75,
      completed: true,
      espnEventId: "wrong-sport",
      startsAt,
    },
  ];
  assert.deepEqual(
    playerPropCandidateEventIds(
      { sport: "MLB", eventStartsAt: startsAt },
      games,
    ),
    ["nearby"],
  );
  assert.deepEqual(
    playerPropCandidateEventIds({ sport: "MLB", eventStartsAt: null }, games),
    [],
  );
});

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
      name: "Aaron Judge",
      team: "New York Yankees",
      played: true,
      stats: { hits: 2, totalBases: 5, homeRuns: 1, rbis: 3, runs: 2 },
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
  // Two different markets on two different stat lines.
  assert.equal(statKeyForMarket("Hits"), "hits");
  assert.equal(statKeyForMarket("Hits Allowed"), "hitsAllowed");
  assert.equal(statKeyForMarket("Total Bases"), "totalBases");
  assert.equal(statKeyForMarket("Home Runs"), "homeRuns");
  assert.equal(statKeyForMarket("RBIs"), "rbis");
  assert.equal(statKeyForMarket("Runs Scored"), "runs");
  assert.equal(statKeyForMarket("Hits+Runs+RBIs"), "hitsRunsRbis");
});

test("core MLB batter props settle from official batting stats", () => {
  for (const [market, line, outcome] of [
    ["Total Bases", 4.5, "WIN"],
    ["Home Runs", 1.5, "LOSS"],
    ["RBIs", 2.5, "WIN"],
    ["Runs Scored", 2, "PUSH"],
    ["Hits+Runs+RBIs", 6.5, "WIN"],
  ] as const) {
    assert.equal(
      resolvePlayerProp(
        {
          market,
          selection: `Aaron Judge Over ${line}`,
          side: "Over",
          line,
        },
        box,
      ),
      outcome,
      market,
    );
  }
});

test("hits allowed settles off the pitching line, never the batting one", () => {
  const box = {
    players: [
      {
        name: "Michael Wacha",
        team: "Kansas City Royals",
        played: true,
        // A pitcher who surrendered 6 hits and, batting, got none.
        stats: { hitsAllowed: 6, hits: 0, outs: 17 },
      },
    ],
  };
  assert.equal(
    resolvePlayerProp(
      {
        market: "Hits Allowed",
        selection: "Michael Wacha Over 5.5",
        side: "Over",
        line: 5.5,
      },
      box,
    ),
    "WIN",
  );
  // The same athlete's batting hits are a different market and lose here.
  assert.equal(
    resolvePlayerProp(
      {
        market: "Hits",
        selection: "Michael Wacha Over 5.5",
        side: "Over",
        line: 5.5,
      },
      box,
    ),
    "LOSS",
  );
});

test("Pts+Reb+Ast sums its components, and defers when one is missing", () => {
  const line = {
    name: "Sabrina Ionescu",
    team: "New York Liberty",
    played: true,
    stats: { points: 20, rebounds: 5, assists: 6 },
  };
  const play = {
    market: "Pts+Reb+Ast",
    selection: "Sabrina Ionescu Over 30.5",
    side: "Over",
    line: 30.5,
  };
  assert.equal(resolvePlayerProp(play, { players: [line] }), "WIN");
  assert.equal(
    resolvePlayerProp(
      { ...play, selection: "Sabrina Ionescu Under 30.5", side: "Under" },
      { players: [line] },
    ),
    "LOSS",
  );
  // A missing component must defer, not settle on a partial sum — 20 + 6 would
  // read as UNDER and write a wrong result confidently.
  assert.equal(
    resolvePlayerProp(play, {
      players: [{ ...line, stats: { points: 20, assists: 6 } }],
    }),
    null,
  );
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
              labels: ["AB", "R", "H", "2B", "3B", "HR", "RBI"],
              athletes: [
                {
                  athlete: { displayName: "Bobby Witt Jr." },
                  stats: ["4", "2", "3", "1", "0", "1", "3"],
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
  // The pitcher SURRENDERED six hits. Landing that on `hits` would settle a
  // "Hits" prop — the batting market — against the pitching line. Asserted
  // BEFORE the deepEqual below, which narrows `stats` to its literal shape and
  // would make this a type error rather than a check.
  assert.equal(wacha?.stats.hits, undefined);
  assert.deepEqual(wacha?.stats, {
    outs: 17,
    strikeouts: 1,
    earnedRuns: 3,
    hitsAllowed: 6,
  });
  assert.equal(wacha?.played, true);

  // "H" on the batting line is hits; it must not become a pitching stat.
  const witt = mapped.players.find((p) => p.name === "Bobby Witt Jr.");
  assert.deepEqual(witt?.stats, {
    runs: 2,
    hits: 3,
    doubles: 1,
    triples: 0,
    homeRuns: 1,
    rbis: 3,
    totalBases: 7,
  });
  assert.equal(witt?.stats.hitsAllowed, undefined);

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
