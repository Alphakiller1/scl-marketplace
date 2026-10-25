import assert from "node:assert/strict";
import { test } from "node:test";

import {
  findPlayer,
  normalizeName,
  playerNameFromSelection,
  playerPropCandidateEventIds,
  resolvePlayerProp,
  sameGivenName,
  statKeyForMarket,
  type PlayerBoxScore,
  resolveAbsentPlayerProp,
} from "@/lib/results/player-props";
import {
  inningsToOuts,
  mapSummaryToPlayerBox,
  fetchNflParticipation,
} from "@/lib/results/stats-provider";
import { halfBox } from "@/lib/results/prop-resolve";
import { PROP_MARKET_LABEL, PROP_MARKETS_BY_SPORT } from "@/lib/odds-verify";

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
 * Production, 2026-10-25: Rockets @ Hawks (00:30Z) was in the fourth quarter
 * when Wizards @ Bulls (00:00Z) went final. The Rockets game had no settled
 * copy yet, so "Jabari Smith Jr Over 4.5" rebounds fell to the neighbour
 * search, found Jalen Smith (3 REB) as the only "J. Smith" in a finished box
 * score, and published a LOSS. Jabari finished with 5.
 */
test("a prop that names its clubs never borrows a neighbouring game's box score", () => {
  const eventStartsAt = new Date("2026-10-25T00:40:00Z");
  const games = [
    {
      sport: "NBA",
      home: "Chicago Bulls",
      away: "Washington Wizards",
      homeScore: 118,
      awayScore: 110,
      completed: true,
      espnEventId: "401909857",
      startsAt: new Date("2026-10-25T00:00:00Z"),
    },
  ];
  assert.deepEqual(
    playerPropCandidateEventIds(
      {
        sport: "NBA",
        eventStartsAt,
        homeTeam: "Atlanta Hawks",
        awayTeam: "Houston Rockets",
      },
      games,
    ),
    [],
  );
  // The same play with no clubs on it (the legacy picker rows this search
  // exists for) still sees the neighbour, and the box-score name check
  // decides from there.
  assert.deepEqual(
    playerPropCandidateEventIds({ sport: "NBA", eventStartsAt }, games),
    ["401909857"],
  );
});

const jabariOver = {
  market: "Rebounds",
  selection: "Jabari Smith Jr Over 4.5",
  side: "Over",
  line: 4.5,
};

test("a shared surname and initial is not the same player", () => {
  const bulls: PlayerBoxScore = {
    players: [
      {
        name: "Jalen Smith",
        team: "Chicago Bulls",
        played: true,
        stats: { rebounds: 3 },
      },
    ],
  };
  assert.equal(findPlayer(bulls, "Jabari Smith Jr"), null);
  assert.equal(resolvePlayerProp(jabariOver, bulls), null);
});

test("given names match on shortenings, initials and known nicknames only", () => {
  for (const [a, b] of [
    ["josh", "joshua"],
    ["cam", "cameron"],
    ["dj", "dj"],
    ["j", "jabari"],
    ["mike", "michael"],
    ["jake", "jacob"],
    ["michaela", "michael"], // a middle initial on one side
  ]) {
    assert.equal(sameGivenName(a!, b!), true, `${a} / ${b}`);
  }
  for (const [a, b] of [
    ["jabari", "jalen"],
    ["joshua", "trey"],
    ["tyler", "trevor"],
  ]) {
    assert.equal(sameGivenName(a!, b!), false, `${a} / ${b}`);
  }
});

test("a prop settles only on a player from one of the play's clubs", () => {
  const clubs = ["Atlanta Hawks", "Houston Rockets"];
  const elsewhere: PlayerBoxScore = {
    players: [
      {
        name: "Jabari Smith Jr.",
        team: "Chicago Bulls",
        played: true,
        stats: { rebounds: 3 },
      },
    ],
  };
  // However a neighbouring game's box score is reached, it cannot settle.
  assert.equal(resolvePlayerProp({ ...jabariOver, clubs }, elsewhere), null);

  const own: PlayerBoxScore = {
    players: [
      {
        name: "Jabari Smith Jr.",
        team: "Houston Rockets",
        played: true,
        stats: { rebounds: 5 },
      },
    ],
  };
  assert.equal(resolvePlayerProp({ ...jabariOver, clubs }, own), "WIN");
  // ESPN writes "LA Clippers"; the Odds API writes "Los Angeles Clippers".
  assert.equal(
    resolvePlayerProp(
      { ...jabariOver, clubs: ["Los Angeles Clippers", "Houston Rockets"] },
      {
        players: [{ ...own.players[0]!, team: "LA Clippers" }],
      },
    ),
    "WIN",
  );
  // An abbreviation alone is not evidence of the wrong game.
  assert.equal(
    resolvePlayerProp(
      { ...jabariOver, clubs },
      { players: [{ ...own.players[0]!, team: "HOU" }] },
    ),
    "WIN",
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
              labels: ["AB", "R", "H", "2B", "3B", "HR", "RBI", "BB", "K"],
              athletes: [
                {
                  athlete: { displayName: "Bobby Witt Jr." },
                  stats: ["4", "2", "3", "1", "0", "1", "3", "2", "1"],
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
  // Same trap as "H", one column over: "BB" is on both lines, and the walks a
  // pitcher ISSUED must never settle a hitter's walk prop.
  assert.equal(wacha?.stats.walks, undefined);
  assert.equal(wacha?.stats.batterStrikeouts, undefined);
  assert.deepEqual(wacha?.stats, {
    outs: 17,
    strikeouts: 1,
    earnedRuns: 3,
    hitsAllowed: 6,
    walksAllowed: 1,
  });
  assert.equal(wacha?.played, true);

  // "H" on the batting line is hits; it must not become a pitching stat.
  const witt = mapped.players.find((p) => p.name === "Bobby Witt Jr.");
  assert.equal(witt?.stats.hitsAllowed, undefined);
  assert.equal(witt?.stats.walksAllowed, undefined);
  assert.deepEqual(witt?.stats, {
    runs: 2,
    hits: 3,
    doubles: 1,
    triples: 0,
    homeRuns: 1,
    rbis: 3,
    walks: 2,
    batterStrikeouts: 1,
    totalBases: 7,
    // No box score has a singles column — three hits minus the double and the
    // home run is the one single.
    singles: 1,
  });

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

test("football box scores read yards from the group that earned them", () => {
  // ESPN's football summary names its groups rather than typing them, and
  // labels all three yardage columns "YDS" — the shape this mapper has to
  // survive. Trimmed from a real `football/nfl/summary` response.
  const summary = {
    boxscore: {
      players: [
        {
          team: { displayName: "Seattle Seahawks" },
          statistics: [
            {
              name: "passing",
              labels: ["C/ATT", "YDS", "AVG", "TD", "INT", "SACKS", "QBR"],
              athletes: [
                {
                  athlete: { displayName: "Sam Darnold" },
                  stats: ["18/24", "241", "10.0", "2", "0", "1-7", "78.4"],
                },
              ],
            },
            {
              name: "rushing",
              labels: ["CAR", "YDS", "AVG", "TD", "LONG"],
              athletes: [
                {
                  athlete: { displayName: "Kenneth Walker III" },
                  stats: ["17", "83", "4.9", "1", "22"],
                },
                // The quarterback appears in two groups; each yardage column
                // must land on its own key rather than overwrite the other.
                {
                  athlete: { displayName: "Sam Darnold" },
                  stats: ["3", "12", "4.0", "0", "8"],
                },
              ],
            },
            {
              name: "receiving",
              labels: ["REC", "YDS", "AVG", "TD", "LONG", "TGTS"],
              athletes: [
                {
                  athlete: { displayName: "Jaxon Smith-Njigba" },
                  stats: ["7", "132", "18.9", "1", "44", "9"],
                },
              ],
            },
            {
              // The trap: "REC" here is fumbles RECOVERED. Read off the default
              // map it silently overwrote the receiver's catches.
              name: "fumbles",
              labels: ["FUM", "LOST", "REC"],
              athletes: [
                {
                  athlete: { displayName: "Jaxon Smith-Njigba" },
                  stats: ["1", "0", "1"],
                },
              ],
            },
            {
              // Same shape, one column over: "PTS" is the kicker's scoring.
              name: "kicking",
              labels: ["FG", "PCT", "LONG", "XP", "PTS"],
              athletes: [
                {
                  athlete: { displayName: "Jason Myers" },
                  stats: ["2/2", "100.0", "48", "3/3", "9"],
                },
              ],
            },
          ],
        },
      ],
    },
  };

  const mapped = mapSummaryToPlayerBox(summary);
  assert.ok(mapped);
  const darnold = mapped.players.find((p) => p.name === "Sam Darnold");
  assert.equal(darnold?.stats.passingYards, 241);
  assert.equal(darnold?.stats.rushingYards, 12);

  const walker = mapped.players.find((p) => p.name === "Kenneth Walker III");
  assert.equal(walker?.stats.rushingYards, 83);
  assert.equal(walker?.stats.passingYards, undefined);

  const jsn = mapped.players.find((p) => p.name === "Jaxon Smith-Njigba");
  assert.equal(jsn?.stats.receivingYards, 132);
  // Seven catches, one fumble recovery. The fumbles group must not touch it.
  assert.equal(jsn?.stats.receptions, 7);

  const myers = mapped.players.find((p) => p.name === "Jason Myers");
  assert.equal(myers?.stats.points, undefined);
});

test("board-written football props settle against the box score", () => {
  const box: PlayerBoxScore = {
    players: [
      {
        name: "Sam Darnold",
        team: "Seattle Seahawks",
        played: true,
        stats: { passingYards: 241, rushingYards: 12 },
      },
      {
        name: "Jaxon Smith-Njigba",
        team: "Seattle Seahawks",
        played: true,
        stats: { receptions: 7, receivingYards: 132 },
      },
    ],
  };

  assert.equal(
    resolvePlayerProp(
      {
        market: "Passing Yds",
        selection: "Sam Darnold Over 225.5",
        side: "over",
        line: 225.5,
      },
      box,
    ),
    "WIN",
  );
  assert.equal(
    resolvePlayerProp(
      {
        market: "Receiving Yds",
        selection: "Jaxon Smith-Njigba Under 99.5",
        side: "under",
        line: 99.5,
      },
      box,
    ),
    "LOSS",
  );
  assert.equal(
    resolvePlayerProp(
      {
        market: "Receptions",
        selection: "Jaxon Smith-Njigba Over 5.5",
        side: "over",
        line: 5.5,
      },
      box,
    ),
    "WIN",
  );
});

test("lineless Anytime Touchdown grades yes/no and excludes passing touchdowns", () => {
  const box: PlayerBoxScore = {
    players: [
      {
        name: "Bryce Young",
        team: "Carolina Panthers",
        played: true,
        stats: { passingTds: 3, rushingTds: 0, touchdownsScored: 0 },
      },
      {
        name: "Zach Charbonnet",
        team: "Seattle Seahawks",
        played: true,
        stats: { rushingTds: 1, touchdownsScored: 1 },
      },
    ],
  };

  assert.equal(
    resolvePlayerProp(
      {
        market: "Anytime Touchdown",
        selection: "Bryce Young Anytime Touchdown",
        side: "Yes",
      },
      box,
    ),
    "LOSS",
  );
  assert.equal(
    resolvePlayerProp(
      {
        market: "Anytime Touchdown",
        selection: "Zach Charbonnet Anytime Touchdown",
        side: "Yes",
      },
      box,
    ),
    "WIN",
  );
});

test("every prop label the board can write has a stat key", () => {
  // The gap this closes: `isDeferredProp` recognises a prop by its LABEL, so an
  // unmapped label defers correctly and then never grades — the play sits
  // PENDING for as long as the label has no key. Any new market added to
  // PROP_MARKET_LABEL must arrive with its stat key.
  for (const label of Object.values(PROP_MARKET_LABEL)) {
    assert.ok(
      statKeyForMarket(label),
      `${label} has no stat key, so a play on it can never auto-grade`,
    );
  }
});

test("the football card reads every column the owners asked for", () => {
  // Column shapes taken from a real `football/nfl/summary`: "C/ATT" and "FG"
  // both pack two numbers into one cell, and the market wants a different half
  // of each — attempts from the passer, makes from the kicker.
  const summary = {
    boxscore: {
      players: [
        {
          team: { displayName: "Seattle Seahawks" },
          statistics: [
            {
              name: "passing",
              labels: ["C/ATT", "YDS", "AVG", "TD", "INT"],
              athletes: [
                {
                  athlete: { displayName: "Sam Darnold" },
                  stats: ["20/30", "249", "8.3", "3", "0"],
                },
              ],
            },
            {
              name: "rushing",
              labels: ["CAR", "YDS", "AVG", "TD", "LONG"],
              athletes: [
                {
                  athlete: { displayName: "Sam Darnold" },
                  stats: ["2", "8", "4.0", "0", "6"],
                },
                {
                  athlete: { displayName: "Zach Charbonnet" },
                  stats: ["7", "46", "6.6", "1", "18"],
                },
              ],
            },
            {
              name: "receiving",
              labels: ["REC", "YDS", "AVG", "TD", "LONG"],
              athletes: [
                {
                  athlete: { displayName: "Zach Charbonnet" },
                  stats: ["2", "20", "10.0", "0", "14"],
                },
                {
                  athlete: { displayName: "Rashid Shaheed" },
                  stats: ["4", "67", "16.8", "0", "31"],
                },
              ],
            },
            {
              name: "kicking",
              labels: ["FG", "PCT", "LONG", "XP", "PTS"],
              athletes: [
                {
                  athlete: { displayName: "Jason Myers" },
                  stats: ["3/3", "100.0", "48", "2/2", "11"],
                },
              ],
            },
          ],
        },
      ],
    },
  };

  const box = mapSummaryToPlayerBox(summary);
  assert.ok(box);
  const darnold = box.players.find((p) => p.name === "Sam Darnold");
  assert.equal(darnold?.stats.passAttempts, 30);
  assert.equal(darnold?.stats.passingTds, 3);
  assert.equal(darnold?.stats.passingYards, 249);
  // Throwing a touchdown never wins an Anytime TD scorer ticket.
  assert.equal(darnold?.stats.touchdownsScored, 0);

  const charbonnet = box.players.find((p) => p.name === "Zach Charbonnet");
  assert.equal(charbonnet?.stats.rushAttempts, 7);
  assert.equal(charbonnet?.stats.rushingYards, 46);
  assert.equal(charbonnet?.stats.receivingYards, 20);
  assert.equal(charbonnet?.stats.touchdownsScored, 1);

  const myers = box.players.find((p) => p.name === "Jason Myers");
  assert.equal(myers?.stats.fieldGoalsMade, 3);
  // The kicker's "PTS" must not read as a basketball points line.
  assert.equal(myers?.stats.points, undefined);

  // Rush+Rec sums both halves for a back who did both...
  assert.equal(
    resolvePlayerProp(
      {
        market: "Rush+Rec Yds",
        selection: "Zach Charbonnet Over 50.5",
        side: "over",
        line: 50.5,
      },
      box,
    ),
    "WIN",
  );
  // ...and treats the missing half as zero for a receiver who never ran, who is
  // exactly the player this market is written about. Deferring here would leave
  // every wideout's Rush+Rec prop pending forever.
  assert.equal(
    resolvePlayerProp(
      {
        market: "Rush+Rec Yds",
        selection: "Rashid Shaheed Over 50.5",
        side: "over",
        line: 50.5,
      },
      box,
    ),
    "WIN",
  );
});

test("a surname fallback needs the same first initial", () => {
  const box: PlayerBoxScore = {
    players: [
      {
        name: "Trey Palmer",
        team: "BUF",
        played: true,
        stats: { receptions: 3 },
      },
      { name: "DJ Moore", team: "BUF", played: true, stats: { receptions: 5 } },
    ],
  };
  // Joshua Palmer played without a catch and is absent: never Trey's line.
  assert.equal(findPlayer(box, "Joshua Palmer"), null);
  assert.equal(
    (findPlayer(box, "D.J. Moore") as { name: string }).name,
    "DJ Moore",
  );
});

test("an NFL player missing from the box score settles from game-day status", () => {
  const over = {
    market: "Receiving Yds",
    selection: "Joshua Palmer Over 24.5",
    side: "Over",
    line: 24.5,
  };
  const under = {
    market: "Rushing Yds",
    selection: "Ray Davis Under 9.5",
    side: "Under",
    line: 9.5,
  };
  const atd = {
    market: "Anytime Touchdown",
    selection: "Ray Davis Anytime Touchdown",
    side: "Yes",
    line: null,
  };
  const rushRec = {
    market: "Rush+Rec Yds",
    selection: "Ray Davis Over 20.5",
    side: "Over",
    line: 20.5,
  };
  assert.equal(resolveAbsentPlayerProp(over, "played_no_stats"), "LOSS");
  assert.equal(resolveAbsentPlayerProp(under, "played_no_stats"), "WIN");
  assert.equal(resolveAbsentPlayerProp(atd, "played_no_stats"), "LOSS");
  assert.equal(resolveAbsentPlayerProp(rushRec, "played_no_stats"), "LOSS");
  assert.equal(resolveAbsentPlayerProp(over, "did_not_play"), "VOID");
  // A non-football market is never zero-filled.
  assert.equal(
    resolveAbsentPlayerProp(
      {
        market: "Points",
        selection: "A Wilson Over 19.5",
        side: "Over",
        line: 19.5,
      },
      "played_no_stats",
    ),
    null,
  );
});

test("NFL roster participation requires one exact full-name match off the box score", async () => {
  const box: PlayerBoxScore = {
    espnTeamIds: ["24", "2"],
    players: [
      {
        name: "Josh Allen",
        team: "BUF",
        played: true,
        stats: {},
        espnId: "3918298",
      },
    ],
  };
  const athletes: Record<string, string> = {
    a1: "Joshua Palmer",
    a2: "Trey Lance",
    a3: "Josh Allen",
  };
  const rosters: Record<string, unknown[]> = {
    "24": [
      {
        playerId: 1,
        didNotPlay: false,
        displayName: "Palmer",
        athlete: { $ref: "http://x/a1" },
      },
      {
        playerId: 2,
        didNotPlay: true,
        displayName: "Lance",
        athlete: { $ref: "http://x/a2" },
      },
    ],
    "2": [
      {
        playerId: 3918298,
        didNotPlay: false,
        displayName: "Allen",
        athlete: { $ref: "http://x/a3" },
      },
    ],
  };
  const fakeFetch = (async (url: string) => {
    const team = url.match(/competitors\/(\d+)\/roster/)?.[1];
    const body = team
      ? { entries: rosters[team] }
      : { fullName: athletes[url.split("/").pop()!] };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  assert.equal(
    await fetchNflParticipation("9", box, "Joshua Palmer", fakeFetch),
    "played_no_stats",
  );
  assert.equal(
    await fetchNflParticipation("9", box, "Trey Lance", fakeFetch),
    "did_not_play",
  );
  // In the box score already: never zero-filled from the roster.
  assert.equal(
    await fetchNflParticipation("9", box, "Josh Allen", fakeFetch),
    null,
  );
  // Surname on the roster, full name not: defer.
  assert.equal(
    await fetchNflParticipation("9", box, "Hollywood Palmer", fakeFetch),
    null,
  );
});

test("the second half includes overtime; NCAAB halves are single periods", () => {
  // GB @ NYJ, 2026-09-14: NYJ 0,7,7,3,0 / GB 0,7,0,10,3 — GB won the 2nd half 13-10.
  const box = { homePeriods: [0, 7, 7, 3, 0], awayPeriods: [0, 7, 0, 10, 3] };
  assert.deepEqual(halfBox(box, "NFL", true), {
    homePeriods: [7, 3, 0],
    awayPeriods: [0, 10, 3],
  });
  assert.deepEqual(halfBox(box, "NFL", false), {
    homePeriods: [0, 7],
    awayPeriods: [0, 7],
  });
  const ncaab = { homePeriods: [30, 41], awayPeriods: [35, 33] };
  assert.deepEqual(halfBox(ncaab, "NCAAB", false), {
    homePeriods: [30],
    awayPeriods: [35],
  });
  // Not played far enough yet: defer.
  assert.equal(
    halfBox({ homePeriods: [7, 3], awayPeriods: [0, 3] }, "NFL", true),
    null,
  );
});

test("every NBA prop the expanded board buys has a grader", () => {
  // The board must never cache a market the deployed grader cannot settle:
  // an unknown label falls through to the full-game resolver.
  const nbaBox: PlayerBoxScore = {
    players: [
      {
        name: "Jalen Brunson",
        team: "New York Knicks",
        played: true,
        stats: {
          points: 31,
          rebounds: 4,
          assists: 8,
          threes: 3,
          blocks: 0,
          steals: 2,
          turnovers: 3,
        },
      },
    ],
  };
  for (const key of PROP_MARKETS_BY_SPORT.NBA ?? []) {
    const outcome = resolvePlayerProp(
      {
        market: PROP_MARKET_LABEL[key] ?? key,
        selection: "Jalen Brunson Over 0.5",
        side: "Over",
        line: 0.5,
      },
      nbaBox,
    );
    assert.ok(outcome, `${key} should grade, got ${outcome}`);
  }
  // Pts+Reb+Ast = 43 against 42.5.
  assert.equal(
    resolvePlayerProp(
      {
        market: PROP_MARKET_LABEL.player_points_rebounds_assists,
        selection: "Jalen Brunson Over 42.5",
        side: "Over",
        line: 42.5,
      },
      nbaBox,
    ),
    "WIN",
  );
});

test("NBA halves split four quarters two and two, overtime in the second", () => {
  const box = {
    homePeriods: [28, 30, 25, 22, 9],
    awayPeriods: [31, 24, 27, 23, 6],
  };
  assert.deepEqual(halfBox(box, "NBA", false), {
    homePeriods: [28, 30],
    awayPeriods: [31, 24],
  });
  assert.deepEqual(halfBox(box, "NBA", true), {
    homePeriods: [25, 22, 9],
    awayPeriods: [27, 23, 6],
  });
});
