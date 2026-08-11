import assert from "node:assert/strict";
import { test } from "node:test";

import { marketKeysForMarket, verificationMarkets } from "@/lib/odds-verify";
import { findGame, type GradablePlay } from "@/lib/results/match";
import type { SettledGame } from "@/lib/results/settled-game";

/**
 * A live pick must never be graded from an older game.
 *
 * The settled pool spans two weeks of scoreboard history, so a team plays many
 * times inside it. When an event-bound play fell through to team-name matching,
 * today's Houston Astros pick matched *last week's* Astros game and settled as a
 * WIN while the real game was 0-0 in the third inning.
 */
const YESTERDAYS_ASTROS_GAME: SettledGame = {
  sport: "MLB",
  home: "Houston Astros",
  away: "Seattle Mariners",
  homeScore: 7,
  awayScore: 2,
  completed: true,
  eventId: "evt-mlb-yesterday",
};

const play = (over: Partial<GradablePlay> = {}): GradablePlay => ({
  id: "play-1",
  sport: "MLB",
  market: "Moneyline",
  selection: "Houston Astros",
  oddsAmerican: -140,
  units: 1,
  eventId: "evt-mlb-today",
  ...over,
});

test("an event-bound play is not graded from a different game", () => {
  // Today's game is still in progress, so it is absent from the settled pool.
  // The only Astros game present is an earlier, finished one.
  assert.equal(findGame(play(), [YESTERDAYS_ASTROS_GAME]), null);
});

test("an event-bound play still grades against its own event", () => {
  const todaysGame: SettledGame = {
    sport: "MLB",
    home: "Houston Astros",
    away: "Texas Rangers",
    homeScore: 5,
    awayScore: 1,
    completed: true,
    eventId: "evt-mlb-today",
  };
  const found = findGame(play(), [YESTERDAYS_ASTROS_GAME, todaysGame]);
  assert.equal(found?.eventId, "evt-mlb-today");
});

test("an event-bound play matches the same fixture from a backstop provider", () => {
  const start = new Date("2026-08-10T23:10:00.000Z");
  const espnGame: SettledGame = {
    sport: "MLB",
    home: "Houston Astros",
    away: "Texas Rangers",
    homeScore: 5,
    awayScore: 1,
    completed: true,
    eventId: "espn:401999001",
    espnEventId: "401999001",
    startsAt: new Date("2026-08-10T23:12:00.000Z"),
  };
  const found = findGame(
    play({
      eventId: "0f2a3b4c5d6e7f8091a2b3c4d5e6f708",
      eventLabel: "Texas Rangers @ Houston Astros",
      eventStartsAt: start,
    }),
    [espnGame],
  );
  assert.equal(found?.eventId, "espn:401999001");
});

test("a legacy bound play missing its fixture label recovers from team and start slot", () => {
  const found = findGame(
    play({
      selection: "Tampa Bay Rays (F5 ML)",
      eventId: "79a0c1e324175df9d0c7f93de8d4dc44",
      eventLabel: null,
      eventStartsAt: new Date("2026-08-09T01:50:00.000Z"),
    }),
    [
      {
        sport: "MLB",
        home: "Seattle Mariners",
        away: "Tampa Bay Rays",
        homeScore: 2,
        awayScore: 4,
        completed: true,
        eventId: "espn:401999004",
        startsAt: new Date("2026-08-09T01:52:00.000Z"),
      },
    ],
  );
  assert.equal(found?.eventId, "espn:401999004");
});

test("cross-provider matching still rejects an older same-team result", () => {
  const found = findGame(
    play({
      eventLabel: "Texas Rangers @ Houston Astros",
      eventStartsAt: new Date("2026-08-10T23:10:00.000Z"),
    }),
    [
      {
        ...YESTERDAYS_ASTROS_GAME,
        away: "Texas Rangers",
        startsAt: new Date("2026-08-09T23:10:00.000Z"),
        eventId: "espn:401999000",
      },
    ],
  );
  assert.equal(found, null);
});

test("cross-provider matching refuses an ambiguous doubleheader", () => {
  const start = new Date("2026-08-10T20:00:00.000Z");
  const fixture = (id: string, startsAt: string): SettledGame => ({
    sport: "MLB",
    home: "Houston Astros",
    away: "Texas Rangers",
    homeScore: 5,
    awayScore: 1,
    completed: true,
    eventId: `espn:${id}`,
    startsAt: new Date(startsAt),
  });
  const found = findGame(
    play({
      eventLabel: "Texas Rangers @ Houston Astros",
      eventStartsAt: start,
    }),
    [
      fixture("401999002", "2026-08-10T19:30:00.000Z"),
      fixture("401999003", "2026-08-10T20:30:00.000Z"),
    ],
  );
  assert.equal(found, null);
});

test("a finished doubleheader opener cannot settle a bound nightcap", () => {
  const found = findGame(
    play({
      eventLabel: null,
      eventStartsAt: new Date("2026-08-10T22:00:00.000Z"),
    }),
    [
      {
        sport: "MLB",
        home: "Houston Astros",
        away: "Texas Rangers",
        homeScore: 5,
        awayScore: 1,
        completed: true,
        eventId: "espn:401999002",
        startsAt: new Date("2026-08-10T19:00:00.000Z"),
      },
    ],
  );
  assert.equal(found, null);
});

test("a play with no event id may still match on team names", () => {
  // Legacy and free-text picks carry no binding; name matching is all there is,
  // and removing it would leave them permanently ungradable.
  const found = findGame(play({ eventId: null }), [YESTERDAYS_ASTROS_GAME]);
  assert.equal(found?.eventId, "evt-mlb-yesterday");
});

test("event binding is not defeated by a same-name game in another sport", () => {
  const found = findGame(play({ sport: "NBA" }), [YESTERDAYS_ASTROS_GAME]);
  assert.equal(found, null);
});

// ── alternate prop markets ───────────────────────────────────────────────────

/**
 * Milestone "X+" lines (6+ strikeouts) exist ONLY under the `_alternate` market
 * key. Requesting the featured key alone is why lines visible at the book never
 * reached the board.
 */
test("curated props request their alternate market too", () => {
  const mlb = verificationMarkets("MLB");
  assert.ok(mlb.includes("pitcher_strikeouts"));
  assert.ok(mlb.includes("pitcher_strikeouts_alternate"));
  assert.ok(mlb.includes("batter_hits_alternate"));
});

test("game lines keep their existing alternate bundling", () => {
  const mlb = verificationMarkets("MLB");
  assert.ok(mlb.includes("alternate_spreads"));
  assert.ok(mlb.includes("alternate_totals"));
});

test("a prop label verifies against featured and alternate", () => {
  assert.deepEqual(marketKeysForMarket("Strikeouts"), [
    "pitcher_strikeouts",
    "pitcher_strikeouts_alternate",
  ]);
});

test("every requested market is unique — duplicates would waste credits", () => {
  for (const sport of ["MLB", "NBA", "NFL", "WNBA", "NHL"]) {
    const markets = verificationMarkets(sport);
    assert.equal(
      markets.length,
      new Set(markets).size,
      `${sport} requests a duplicate market`,
    );
  }
});
