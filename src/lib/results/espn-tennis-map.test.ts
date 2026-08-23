import assert from "node:assert/strict";
import test from "node:test";

import {
  findGame,
  resolveOutcome,
  type GradablePlay,
} from "@/lib/results/match";
import { mapEspnTennisScoreboard } from "@/lib/results/espn-tennis-map";

const FILS_COBOLLI_BOARD = {
  events: [
    {
      id: "718-2026",
      name: "Cincinnati Open",
      groupings: [
        {
          competitions: [
            {
              id: "181987",
              date: "2026-08-22T18:15Z",
              status: { type: { completed: true, name: "STATUS_FINAL" } },
              competitors: [
                {
                  homeAway: "away",
                  order: 2,
                  winner: true,
                  athlete: { displayName: "Arthur Fils" },
                  linescores: [{ value: 6 }, { value: 6 }],
                },
                {
                  homeAway: "home",
                  order: 1,
                  winner: false,
                  athlete: { displayName: "Flavio Cobolli" },
                  linescores: [{ value: 3 }, { value: 4 }],
                },
              ],
            },
            {
              id: "live",
              date: "2026-08-23T20:30Z",
              status: { type: { completed: false, name: "STATUS_SCHEDULED" } },
              competitors: [
                {
                  homeAway: "away",
                  winner: false,
                  athlete: { displayName: "Frances Tiafoe" },
                },
                {
                  homeAway: "home",
                  winner: false,
                  athlete: { displayName: "Arthur Fils" },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

test("ESPN tennis groupings flatten to a completed singles final", () => {
  const games = mapEspnTennisScoreboard(FILS_COBOLLI_BOARD);
  assert.equal(games.length, 1);
  assert.equal(games[0]!.sport, "TENNIS");
  assert.equal(games[0]!.away, "Arthur Fils");
  assert.equal(games[0]!.home, "Flavio Cobolli");
  assert.equal(games[0]!.awayScore, 1);
  assert.equal(games[0]!.homeScore, 0);
  assert.equal(games[0]!.eventId, "espn:181987");
  assert.equal(games[0]!.startsAt?.toISOString(), "2026-08-22T18:15:00.000Z");
});

test("Arthur Fils Cincinnati ML matches ESPN across providers", () => {
  // Production: @btts_sports + @vision_vulture7, Odds API event id, board
  // kickoff 17:30Z. ESPN had Fils bt Cobolli 6-3 6-4 at 18:15Z. Tennis was
  // Odds-API-only, so a missed scores row stayed event_not_found past 7h.
  const games = mapEspnTennisScoreboard(FILS_COBOLLI_BOARD);
  const play: GradablePlay = {
    id: "cmt4gpjhs0003l804j6nodyu0",
    sport: "TENNIS",
    market: "Moneyline",
    selection: "Arthur Fils",
    oddsAmerican: -286,
    units: 1,
    eventId: "cf6e6abb36c3b5c36d339a46afce1c05",
    eventStartsAt: new Date("2026-08-22T17:30:00.000Z"),
    homeTeam: "Flavio Cobolli",
    awayTeam: "Arthur Fils",
  };

  assert.equal(findGame(play, games)?.eventId, "espn:181987");
  assert.equal(resolveOutcome(play, games), "WIN");
  assert.equal(
    findGame(
      { ...play, homeTeam: null, awayTeam: null, eventLabel: null },
      games,
    )?.eventId,
    "espn:181987",
  );
});
