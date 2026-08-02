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
