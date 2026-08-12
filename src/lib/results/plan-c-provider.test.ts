import assert from "node:assert/strict";
import test from "node:test";

import { mapMlbOfficialSchedule } from "@/lib/results/mlb-official";
import { mapSportsPuffScores } from "@/lib/results/sportspuff-scores";
import { mapMlbOfficialPlayerBox } from "@/lib/results/stats-provider";

test("MLB official Plan C accepts only final games and retains innings/gamePk", () => {
  const games = mapMlbOfficialSchedule({
    dates: [
      {
        games: [
          {
            gamePk: 824240,
            gameDate: "2026-08-11T22:40:00Z",
            status: { abstractGameState: "Final" },
            teams: {
              home: { score: 6, team: { name: "Detroit Tigers" } },
              away: { score: 4, team: { name: "Cleveland Guardians" } },
            },
            linescore: {
              innings: [
                { home: { runs: 1 }, away: { runs: 0 } },
                { home: { runs: 0 }, away: { runs: 2 } },
              ],
            },
          },
          {
            gamePk: 824241,
            gameDate: "2026-08-12T22:40:00Z",
            status: { abstractGameState: "Live" },
            teams: {
              home: { score: 1, team: { name: "Home" } },
              away: { score: 0, team: { name: "Away" } },
            },
          },
        ],
      },
    ],
  });
  assert.equal(games.length, 1);
  assert.equal(games[0]!.mlbGamePk, "824240");
  assert.deepEqual(games[0]!.homePeriods, [1, 0]);
  assert.deepEqual(games[0]!.awayPeriods, [0, 2]);
});

test("broad-sport Plan C never maps scheduled games as finals", () => {
  const games = mapSportsPuffScores("WNBA", {
    scores: [
      {
        game_id: "final",
        game_time: "2026-08-11T23:30:00Z",
        home_team: "Indiana Fever",
        visitor_team: "New York Liberty",
        home_score: 88,
        visitor_score: 82,
        is_final: true,
      },
      {
        game_id: "live",
        game_time: "2026-08-12T23:30:00Z",
        home_team: "Home",
        visitor_team: "Away",
        home_score: 40,
        visitor_score: 41,
        is_final: false,
      },
    ],
  });
  assert.equal(games.length, 1);
  assert.equal(games[0]!.eventId, "sportspuff:final");
});

test("MLB official box score maps every owner-required baseball prop", () => {
  const box = mapMlbOfficialPlayerBox({
    teams: {
      home: {
        team: { name: "Detroit Tigers" },
        players: {
          ID1: {
            person: { fullName: "Tarik Skubal" },
            stats: {
              batting: { gamesPlayed: 0, hits: 0 },
              pitching: {
                gamesPlayed: 1,
                strikeOuts: 9,
                outs: 21,
                earnedRuns: 2,
              },
            },
          },
          ID2: {
            person: { fullName: "Riley Greene" },
            stats: { batting: { gamesPlayed: 1, hits: 2 } },
          },
        },
      },
    },
  });
  assert.ok(box);
  assert.deepEqual(box.players[0]!.stats, {
    hits: 0,
    strikeouts: 9,
    outs: 21,
    earnedRuns: 2,
  });
  assert.equal(box.players[1]!.stats.hits, 2);
});
