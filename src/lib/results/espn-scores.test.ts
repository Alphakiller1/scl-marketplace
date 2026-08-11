import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canonicalizeEspnTeamName,
  mapEspnScoreboard,
  yyyymmddUtc,
} from "@/lib/results/espn-scoreboard-map";

test("canonicalizeEspnTeamName maps All-Stars to League labels", () => {
  assert.equal(
    canonicalizeEspnTeamName("American All-Stars"),
    "American League",
  );
  assert.equal(
    canonicalizeEspnTeamName("National All-Stars"),
    "National League",
  );
  assert.equal(
    canonicalizeEspnTeamName("Los Angeles Dodgers"),
    "Los Angeles Dodgers",
  );
});

test("yyyymmddUtc formats UTC calendar day", () => {
  assert.equal(yyyymmddUtc(new Date("2026-07-14T18:00:00.000Z")), "20260714");
});

test("mapEspnScoreboard extracts completed finals", () => {
  const games = mapEspnScoreboard("MLB", {
    events: [
      {
        id: "401696123",
        status: { type: { completed: true, name: "STATUS_FINAL" } },
        competitions: [
          {
            competitors: [
              {
                homeAway: "home",
                score: "0",
                linescores: [{ displayValue: "0" }, { displayValue: "1" }],
                team: { displayName: "National All-Stars" },
              },
              {
                homeAway: "away",
                score: "4",
                linescores: [{ value: 2 }, { value: 0 }],
                team: { displayName: "American All-Stars" },
              },
            ],
          },
        ],
      },
      {
        id: "skip-live",
        status: { type: { completed: false, name: "STATUS_IN_PROGRESS" } },
        competitions: [
          {
            competitors: [
              {
                homeAway: "home",
                score: "1",
                team: { displayName: "A" },
              },
              {
                homeAway: "away",
                score: "0",
                team: { displayName: "B" },
              },
            ],
          },
        ],
      },
    ],
  });

  assert.equal(games.length, 1);
  assert.equal(games[0]!.home, "National League");
  assert.equal(games[0]!.away, "American League");
  assert.equal(games[0]!.homeScore, 0);
  assert.equal(games[0]!.awayScore, 4);
  assert.equal(games[0]!.eventId, "espn:401696123");
  assert.deepEqual(games[0]!.homePeriods, [0, 1]);
  assert.deepEqual(games[0]!.awayPeriods, [2, 0]);
});
