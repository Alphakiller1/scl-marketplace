import assert from "node:assert/strict";
import test from "node:test";

import { mapEspnScoreboard } from "@/lib/results/espn-scoreboard-map";
import { mapEspnTennisScoreboard } from "@/lib/results/espn-tennis-map";
import {
  findGame,
  isAutoGradeBlocked,
  resolveOutcome,
  type GradablePlay,
} from "@/lib/results/match";

/**
 * Plays that were finished on the scoreboard and still PENDING on the site.
 *
 * Both cases below sat in production: the grade cron ran, found the fixture
 * final, and left the play ungraded anyway — the soccer one because it could
 * not join two spellings of the same club, the tennis ones because the games
 * markets had no game score to settle against.
 */

/** ESPN ger.dfb_pokal, 2026-08-24: FC Cologne won 2-1 at Würzburg. */
const POKAL_SCOREBOARD = {
  events: [
    {
      id: "401874896",
      date: "2026-08-24T16:00Z",
      competitions: [
        {
          id: "401874896",
          date: "2026-08-24T16:00Z",
          status: { type: { completed: true, name: "STATUS_FULL_TIME" } },
          competitors: [
            {
              homeAway: "home",
              order: 0,
              winner: false,
              score: "1",
              team: { displayName: "Würzburger Kickers" },
            },
            {
              homeAway: "away",
              order: 1,
              winner: true,
              score: "2",
              team: { displayName: "FC Cologne" },
            },
          ],
        },
      ],
    },
  ],
};

test("a DFB Pokal moneyline grades against ESPN's anglicised club name", () => {
  const games = mapEspnScoreboard("SOCCER", POKAL_SCOREBOARD);
  // Production row cmt7duoo2000fju04v7549b5q: full time on the scoreboard,
  // PENDING on the site, and the reason the grade cron returned 503 on every
  // run for a day — event_not_found, because "1 fc koln" matches nothing in
  // "fc cologne" by substring, last token, or abbreviation.
  const play: GradablePlay = {
    id: "cmt7duoo2000fju04v7549b5q",
    sport: "SOCCER",
    market: "Moneyline",
    selection: "1. FC Köln",
    side: "1. FC Köln",
    oddsAmerican: -325,
    units: 1,
    eventId: "0d4d7d4d0f2b4b1d9a1f3f2e5c6b7a89",
    eventLabel: "1. FC Köln @ FC Würzburger Kickers",
    homeTeam: "FC Würzburger Kickers",
    awayTeam: "1. FC Köln",
    eventStartsAt: new Date("2026-08-24T16:00:00.000Z"),
  };

  assert.equal(findGame(play, games)?.espnEventId, "401874896");
  assert.equal(resolveOutcome(play, games), "WIN");
});

/** ESPN WTA Monterrey: Vidmanova bt Udvardy 6-3 3-6 6-3 — 15 games to 12. */
const MONTERREY_SCOREBOARD = {
  events: [
    {
      id: "341-2026",
      name: "Abierto GNP Seguros",
      groupings: [
        {
          competitions: [
            {
              id: "184520",
              date: "2026-08-23T21:10Z",
              status: { type: { completed: true, name: "STATUS_FINAL" } },
              format: { regulation: { periods: 3 } },
              competitors: [
                {
                  homeAway: "away",
                  order: 2,
                  winner: true,
                  athlete: { displayName: "Darja Vidmanova" },
                  linescores: [{ value: 6 }, { value: 3 }, { value: 6 }],
                },
                {
                  homeAway: "home",
                  order: 1,
                  winner: false,
                  athlete: { displayName: "Panna Udvardy" },
                  linescores: [{ value: 3 }, { value: 6 }, { value: 3 }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

function monterreyPlay(over: Partial<GradablePlay>): GradablePlay {
  return {
    id: "tennis-games",
    sport: "TENNIS",
    market: "Total",
    selection: "Over 21.5",
    side: "Over",
    line: 21.5,
    oddsAmerican: -110,
    units: 5,
    eventStartsAt: new Date("2026-08-23T21:10:00.000Z"),
    homeTeam: "Panna Udvardy",
    awayTeam: "Darja Vidmanova",
    ...over,
  } as GradablePlay;
}

test("a tennis total grades from the per-set game score", () => {
  const games = mapEspnTennisScoreboard(MONTERREY_SCOREBOARD);
  assert.equal(games[0]!.regulationPeriods, 3);

  // 27 games played.
  assert.equal(resolveOutcome(monterreyPlay({}), games), "WIN");
  assert.equal(
    resolveOutcome(
      monterreyPlay({ selection: "Under 21.5", side: "Under" }),
      games,
    ),
    "LOSS",
  );
  assert.equal(
    resolveOutcome(
      monterreyPlay({ selection: "Over 27", side: "Over", line: 27 }),
      games,
    ),
    "PUSH",
  );
});

test("a tennis games spread grades from the game margin, not the set score", () => {
  const games = mapEspnTennisScoreboard(MONTERREY_SCOREBOARD);
  // 15-12: a 3-game margin. Read off the 2-1 SET score it would be 1, and
  // -2.5 would book a false LOSS.
  assert.equal(
    resolveOutcome(
      monterreyPlay({
        market: "Spread",
        selection: "Darja Vidmanova -2.5",
        side: "Darja Vidmanova",
        line: -2.5,
      }),
      games,
    ),
    "WIN",
  );
  assert.equal(
    resolveOutcome(
      monterreyPlay({
        market: "Spread",
        selection: "Darja Vidmanova -3.5",
        side: "Darja Vidmanova",
        line: -3.5,
      }),
      games,
    ),
    "LOSS",
  );
  assert.equal(
    resolveOutcome(
      monterreyPlay({
        market: "Spread",
        selection: "Panna Udvardy +3",
        side: "Panna Udvardy",
        line: 3,
      }),
      games,
    ),
    "PUSH",
  );
});

test("a tennis games market with no line scores still defers to a human", () => {
  // Same match as the feed reports it when only the set score is available.
  const setScoreOnly = mapEspnTennisScoreboard(MONTERREY_SCOREBOARD).map(
    (game) => ({
      ...game,
      homePeriods: undefined,
      awayPeriods: undefined,
      regulationPeriods: undefined,
    }),
  );
  const play = monterreyPlay({});
  assert.equal(resolveOutcome(play, setScoreOnly), null);
  assert.equal(isAutoGradeBlocked(play), true);
});

test("a games market bound to the Odds API copy reads the other copy's line scores", () => {
  // The merge collapses the two feeds' copies of a match only when they agree
  // on the hour. When they don't, the play matches the Odds API copy — the one
  // carrying its event id, and no line scores whatsoever.
  const espn = mapEspnTennisScoreboard(MONTERREY_SCOREBOARD);
  const oddsApiCopy = {
    sport: "TENNIS",
    home: "Panna Udvardy",
    away: "Darja Vidmanova",
    homeScore: 1,
    awayScore: 2,
    completed: true,
    eventId: "8532200fce88e2baf9c6bdea478dd6d8",
    startsAt: new Date("2026-08-23T19:30:00.000Z"),
  };
  const pool = [oddsApiCopy, ...espn];
  const play = monterreyPlay({
    eventId: "8532200fce88e2baf9c6bdea478dd6d8",
    eventStartsAt: new Date("2026-08-23T19:30:00.000Z"),
  });

  assert.equal(findGame(play, pool)?.eventId, oddsApiCopy.eventId);
  assert.equal(resolveOutcome(play, pool), "WIN");
});

test("a tennis moneyline is unaffected by the games score", () => {
  const games = mapEspnTennisScoreboard(MONTERREY_SCOREBOARD);
  assert.equal(
    resolveOutcome(
      monterreyPlay({
        market: "Moneyline",
        selection: "Darja Vidmanova",
        side: "Darja Vidmanova",
        line: null,
      }),
      games,
    ),
    "WIN",
  );
});
