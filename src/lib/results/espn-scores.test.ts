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
  assert.equal(canonicalizeEspnTeamName("Internazionale"), "Inter Milan");
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

test("mapEspnScoreboard maps every completed UFC bout on a card", () => {
  const games = mapEspnScoreboard("MMA", {
    events: [
      {
        id: "600059185",
        status: { type: { completed: true, name: "STATUS_FINAL" } },
        competitions: [
          {
            id: "401881926",
            date: "2026-08-15T21:30:00Z",
            status: { type: { completed: true, name: "STATUS_FINAL" } },
            competitors: [
              {
                order: 2,
                winner: true,
                athlete: { displayName: "Jeremiah Wells" },
              },
              {
                order: 1,
                winner: false,
                athlete: { displayName: "Myktybek Orolbai" },
              },
            ],
          },
          {
            id: "401905000",
            date: "2026-08-16T02:00:00Z",
            status: { type: { completed: true, name: "STATUS_FINAL" } },
            competitors: [
              {
                order: 2,
                winner: true,
                athlete: { displayName: "Islam Makhachev" },
              },
              {
                order: 1,
                winner: false,
                athlete: { displayName: "Ian Machado Garry" },
              },
            ],
          },
          {
            id: "live-bout",
            date: "2026-08-16T03:00:00Z",
            status: { type: { completed: false, name: "STATUS_IN_PROGRESS" } },
            competitors: [
              {
                order: 2,
                winner: false,
                athlete: { displayName: "Live A" },
              },
              {
                order: 1,
                winner: false,
                athlete: { displayName: "Live B" },
              },
            ],
          },
        ],
      },
    ],
  });

  assert.equal(games.length, 2);
  assert.equal(games[0]!.home, "Jeremiah Wells");
  assert.equal(games[0]!.away, "Myktybek Orolbai");
  assert.equal(games[0]!.homeScore, 1);
  assert.equal(games[0]!.awayScore, 0);
  assert.equal(games[0]!.eventId, "espn:401881926");
  assert.equal(games[1]!.home, "Islam Makhachev");
  assert.equal(games[1]!.awayScore, 0);
  assert.equal(
    games.some((game) => game.home === "Live A" || game.away === "Live A"),
    false,
  );
});

test("mapEspnScoreboard skips MMA no-contests instead of pushing 0-0", () => {
  const games = mapEspnScoreboard("MMA", {
    events: [
      {
        competitions: [
          {
            id: "nc",
            status: { type: { completed: true, name: "STATUS_FINAL" } },
            competitors: [
              { order: 2, winner: false, athlete: { displayName: "A" } },
              { order: 1, winner: false, athlete: { displayName: "B" } },
            ],
          },
        ],
      },
    ],
  });
  assert.equal(games.length, 0);
});
