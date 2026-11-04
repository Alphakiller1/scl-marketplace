import assert from "node:assert/strict";
import { test } from "node:test";
import { mapEspnScoreboard } from "@/lib/results/espn-scoreboard-map";
import {
  mergeSettledGames,
  type SettledGame,
} from "@/lib/results/settled-game";
import {
  findGame,
  resolveOutcome,
  type GradablePlay,
} from "@/lib/results/match";
import { publicationVerdict } from "@/lib/results/publication-gate";
import { mapSummaryToPlayerBox } from "@/lib/results/stats-provider";
import { resolvePlayerProp } from "@/lib/results/player-props";
import {
  PROP_MARKET_LABEL,
  PROP_MARKETS_BY_SPORT,
  expandedBoardMarkets,
} from "@/lib/odds-verify";
import {
  defaultSportControl,
  allowedExpandedMarkets,
} from "@/lib/odds-control";
import { parseExpandedSportOrder } from "@/lib/manual-odds-population";

const play = (over: Partial<GradablePlay>): GradablePlay => ({
  id: "pick",
  sport: "NCAAB",
  market: "Spread",
  selection: "Gonzaga Bulldogs -7",
  oddsAmerican: -110,
  units: 1,
  ...over,
});
const game = (over: Partial<SettledGame>): SettledGame => ({
  sport: "NCAAB",
  home: "Gonzaga Bulldogs",
  away: "Yale Bulldogs",
  homeScore: 80,
  awayScore: 60,
  completed: true,
  startsAt: new Date("2026-11-03T01:00:00Z"),
  ...over,
});

test("college fixtures sharing both mascots bind to their schools in a crowded slate", () => {
  const actual = game({ eventId: "espn:actual" });
  const other = game({
    home: "Georgia Bulldogs",
    away: "Drake Bulldogs",
    eventId: "espn:other",
  });
  const pick = play({
    eventId: "odds-hash",
    eventLabel: "Yale Bulldogs @ Gonzaga Bulldogs",
    eventStartsAt: actual.startsAt,
  });
  assert.equal(findGame(pick, [other, actual]), actual);
  assert.equal(resolveOutcome(pick, [other, actual]), "WIN");
  assert.equal(findGame(pick, [other]), null);
  assert.equal(
    resolveOutcome(play({ selection: "Bulldogs -7" }), [actual]),
    null,
  );
});

test("a full school name without an event binding does not match other Bulldogs", () => {
  const actual = game({});
  assert.equal(
    findGame(play({}), [game({ home: "Drake Bulldogs" }), actual]),
    actual,
  );
});

test("late NBA finals merge across provider names and settle after Eastern midnight", () => {
  for (const home of ["Los Angeles Clippers", "Golden State Warriors"]) {
    const start = new Date("2026-11-03T03:30:00Z"); // Nov 2, 10:30pm Eastern
    const espnName = home.replace("Los Angeles", "LA");
    const espn = mapEspnScoreboard("NBA", {
      events: [
        {
          id: home,
          date: start.toISOString(),
          status: { type: { completed: true, name: "STATUS_FINAL" } },
          competitions: [
            {
              competitors: [
                {
                  homeAway: "home",
                  score: "118",
                  team: { displayName: espnName },
                },
                {
                  homeAway: "away",
                  score: "110",
                  team: { displayName: "Phoenix Suns" },
                },
              ],
            },
          ],
        },
      ],
    });
    const pool = mergeSettledGames(espn, [
      game({
        sport: "NBA",
        home,
        away: "Phoenix Suns",
        homeScore: 118,
        awayScore: 110,
        eventId: "sportspuff:1",
        startsAt: start,
      }),
    ]);
    assert.equal(pool.length, 1);
    assert.equal(pool[0].reports?.length, 2);
    const pick = play({
      sport: "NBA",
      market: "Moneyline",
      selection: home,
      eventId: "odds-event",
      eventLabel: `Phoenix Suns @ ${home}`,
      eventStartsAt: start,
    });
    assert.equal(resolveOutcome(pick, pool), "WIN");
    assert.equal(
      publicationVerdict(pick, pool[0], new Date("2026-11-03T07:00:00Z")).ok,
      true,
    );
  }
});

const hockeySummary = () => ({
  boxscore: {
    players: [
      {
        team: { displayName: "Example NHL" },
        statistics: [
          {
            name: "forwards",
            labels: ["G", "A", "S", "SOG", "BS", "FW", "TOI"],
            athletes: [
              {
                athlete: { id: "1", displayName: "Skater One" },
                stats: ["1", "0", "5", "0", "2", "8", "21:00"],
              },
              {
                athlete: { id: "2", displayName: "Skater Two" },
                stats: ["0", "1", "2", "1", "0", "0", "18:00"],
              },
            ],
          },
          {
            name: "goalies",
            labels: ["GA", "SV", "TOI"],
            athletes: [
              {
                athlete: { id: "3", displayName: "Goalie One" },
                stats: ["2", "31", "60:00"],
              },
              {
                athlete: { id: "4", displayName: "Goalie Backup" },
                stats: ["0", "0", "0:00"],
              },
            ],
          },
        ],
      },
    ],
  },
  plays: [
    {
      id: "goal-1",
      scoringPlay: true,
      type: { text: "Goal" },
      strength: { abbreviation: "power-play" },
      participants: [
        { type: "scorer", athlete: { id: "1" } },
        { type: "assister", athlete: { id: "2" } },
      ],
    },
  ],
});

test("NHL props use the hockey stat groups, never the shootout column", () => {
  const box = mapSummaryToPlayerBox(hockeySummary())!;
  assert.equal(box.players[0].stats.shotsOnGoal, 5);
  assert.equal(box.players[1].stats.shotsOnGoal, 2);
  assert.equal(box.players[0].stats.points, 1);
  assert.equal(box.players[1].stats.points, 1);
  const examples: Record<string, [string, number]> = {
    "Shots On Goal": ["Skater One", 4.5],
    Goals: ["Skater One", 0.5],
    Points: ["Skater One", 0.5],
    Assists: ["Skater Two", 0.5],
    Saves: ["Goalie One", 30.5],
    "Blocked Shots": ["Skater One", 1.5],
    "Faceoffs Won": ["Skater One", 7.5],
    "Power Play Points": ["Skater Two", 0.5],
  };
  for (const [market, [name, line]] of Object.entries(examples)) {
    assert.equal(
      resolvePlayerProp(
        { market, selection: `${name} Over ${line}`, line, side: "Over" },
        box,
      ),
      "WIN",
      market,
    );
  }
  assert.equal(
    resolvePlayerProp(
      {
        market: "Saves",
        selection: "Goalie Backup Over 0.5",
        line: 0.5,
        side: "Over",
      },
      box,
    ),
    "VOID",
  );
  assert.equal(
    resolvePlayerProp(
      {
        market: "Saves",
        selection: "Skater One Over 0.5",
        line: 0.5,
        side: "Over",
      },
      box,
    ),
    null,
  );
});

test("power play points defer on incomplete goal logs, missing strength, or missing assists", () => {
  const incomplete = hockeySummary();
  incomplete.plays = [];
  const noStrength = hockeySummary();
  noStrength.plays[0].strength.abbreviation = "";
  const noAssist = hockeySummary();
  noAssist.plays[0].participants.pop();
  for (const summary of [incomplete, noStrength, noAssist]) {
    const box = mapSummaryToPlayerBox(summary)!;
    assert.equal(box.players[0].stats.powerPlayPoints, undefined);
    assert.equal(
      resolvePlayerProp(
        {
          market: "Power Play Points",
          selection: "Skater One Under 0.5",
          side: "Under",
          line: 0.5,
        },
        box,
      ),
      null,
    );
  }
});

test("all requested provider-supported NHL markets reach owner controls and the population order", () => {
  const defaults = defaultSportControl("NHL");
  assert.equal(defaults.enabled, true);
  assert.equal(defaults.expandedEnabled, true);
  assert.ok(parseExpandedSportOrder("NHL", ["NHL"]).includes("NHL"));
  const catalog = expandedBoardMarkets("NHL");
  assert.ok(catalog.includes("alternate_spreads"));
  assert.ok(catalog.includes("alternate_totals"));
  for (const key of PROP_MARKETS_BY_SPORT.NHL) {
    assert.ok(PROP_MARKET_LABEL[key]);
    assert.ok(allowedExpandedMarkets("NHL").includes(key), key);
    assert.ok(defaults.expandedMarkets.includes(key), key);
    assert.ok(catalog.includes(`${key}_alternate`), key);
  }
});
