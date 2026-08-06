import assert from "node:assert/strict";
import { test } from "node:test";

import { findGame, type GradablePlay } from "@/lib/results/match";
import type { SettledGame } from "@/lib/results/settled-game";

/**
 * Regression cover for a live production incident.
 *
 * Imported legacy plays carry no eventId, so they reach the name-matching
 * fallback in findGame. That fallback scanned the whole settled pool — two
 * weeks of scoreboard history — and returned the first game mentioning the
 * team. In production this graded 28 picks 1.5-2h after first pitch, i.e.
 * while the games were still being played, against results from days earlier.
 *
 * Matching is now scoped to games starting near the play's own event time.
 */

const TONIGHT = new Date("2026-08-04T23:40:00Z");

function play(over: Partial<GradablePlay> = {}): GradablePlay {
  return {
    id: "p1",
    sport: "MLB",
    market: "MONEYLINE",
    selection: "Milwaukee Brewers",
    oddsAmerican: -110,
    units: 1,
    // Imported legacy plays record the event time here.
    createdAt: TONIGHT,
    ...over,
  };
}

const LAST_WEEKS_BREWERS_GAME: SettledGame = {
  sport: "MLB",
  home: "Milwaukee Brewers",
  away: "Chicago Cubs",
  homeScore: 2,
  awayScore: 7,
  completed: true,
  startsAt: new Date("2026-07-29T23:40:00Z"),
};

const TONIGHTS_BREWERS_GAME: SettledGame = {
  sport: "MLB",
  home: "Milwaukee Brewers",
  away: "St. Louis Cardinals",
  homeScore: 5,
  awayScore: 3,
  completed: true,
  startsAt: new Date("2026-08-04T23:40:00Z"),
};

test("a pick is not graded from the same team's game a week earlier", () => {
  // The exact production failure: tonight's game is still in progress, so the
  // pool holds only last week's. The answer is to wait, not to settle.
  assert.equal(findGame(play(), [LAST_WEEKS_BREWERS_GAME]), null);
});

test("a pick grades against its own game once that game is final", () => {
  const found = findGame(play(), [
    LAST_WEEKS_BREWERS_GAME,
    TONIGHTS_BREWERS_GAME,
  ]);
  assert.equal(found?.away, "St. Louis Cardinals");
});

test("order does not decide the match", () => {
  const found = findGame(play(), [
    TONIGHTS_BREWERS_GAME,
    LAST_WEEKS_BREWERS_GAME,
  ]);
  assert.equal(found?.away, "St. Louis Cardinals");
});

test("a doubleheader later the same day still matches", () => {
  const nightcap: SettledGame = {
    ...TONIGHTS_BREWERS_GAME,
    startsAt: new Date("2026-08-05T02:10:00Z"),
  };
  assert.equal(findGame(play(), [nightcap])?.away, "St. Louis Cardinals");
});

test("eventStartsAt is preferred over createdAt when present", () => {
  const bound = play({
    createdAt: new Date("2026-07-29T23:40:00Z"),
    eventStartsAt: TONIGHT,
  });
  assert.equal(findGame(bound, [TONIGHTS_BREWERS_GAME])?.awayScore, 3);
});

test("undated games are still matchable — filtering only applies when known", () => {
  // A provider that reports no start time must not silently stop grading.
  const undated: SettledGame = {
    ...TONIGHTS_BREWERS_GAME,
    startsAt: undefined,
  };
  assert.equal(findGame(play(), [undated])?.away, "St. Louis Cardinals");
});

test("a play with no date at all falls back to the old behaviour", () => {
  const undatedPlay = play({ createdAt: null, eventStartsAt: null });
  assert.equal(
    findGame(undatedPlay, [LAST_WEEKS_BREWERS_GAME])?.away,
    "Chicago Cubs",
  );
});

/**
 * Second production incident, after the date scoping above shipped.
 *
 * The window was 18h — almost exactly the gap between an afternoon game and
 * the previous evening's. Five picks with no eventId graded 2.2-2.8h after
 * first pitch, while their own games were still being played, against last
 * night's final. The window is now 4h.
 */

test("an afternoon pick does not grade off last night's game", () => {
  // 14:10 ET first pitch; the previous evening's game went off at 20:10 ET.
  const afternoon = play({ createdAt: new Date("2026-08-05T18:10:00Z") });
  const lastNight: SettledGame = {
    ...TONIGHTS_BREWERS_GAME,
    startsAt: new Date("2026-08-05T00:10:00Z"),
  };
  // Exactly 18h apart: the old window let this through.
  assert.equal(findGame(afternoon, [lastNight]), null);
});

test("two games in the window refuse to grade rather than pick one", () => {
  // A doubleheader where the play names only the club: either game could be
  // the one, so neither is. Order must not break the tie.
  const nightcap: SettledGame = {
    ...TONIGHTS_BREWERS_GAME,
    homeScore: 1,
    awayScore: 8,
    startsAt: new Date("2026-08-05T02:10:00Z"),
  };
  assert.equal(findGame(play(), [TONIGHTS_BREWERS_GAME, nightcap]), null);
  assert.equal(findGame(play(), [nightcap, TONIGHTS_BREWERS_GAME]), null);
});

test("a named matchup still grades when only one game fits", () => {
  const specific = play({ selection: "Brewers vs Cardinals" });
  assert.equal(findGame(specific, [TONIGHTS_BREWERS_GAME])?.awayScore, 3);
});

test("event-bound plays are unaffected by date scoping", () => {
  const bound = play({ eventId: "abc", createdAt: TONIGHT });
  const game: SettledGame = {
    ...LAST_WEEKS_BREWERS_GAME,
    eventId: "abc",
  };
  // Explicit binding wins; the eventId path returns before any date filtering.
  assert.equal(findGame(bound, [game])?.eventId, "abc");
});
