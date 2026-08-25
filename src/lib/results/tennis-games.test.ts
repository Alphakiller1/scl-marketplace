import assert from "node:assert/strict";
import test from "node:test";

import { tennisGamesWon } from "@/lib/results/tennis-games";

/** Vidmanova bt Udvardy 6-3 3-6 6-3, Monterrey 2026-08-23. */
const THREE_SETTER = {
  homeScore: 0,
  awayScore: 1,
  homePeriods: [3, 6, 3],
  awayPeriods: [6, 3, 6],
  regulationPeriods: 3,
};

test("a completed match reports the games each side won", () => {
  assert.deepEqual(tennisGamesWon(THREE_SETTER), { home: 12, away: 15 });
  assert.deepEqual(
    tennisGamesWon({
      homeScore: 0,
      awayScore: 1,
      homePeriods: [5, 4],
      awayPeriods: [7, 6],
      regulationPeriods: 3,
    }),
    { home: 9, away: 13 },
  );
});

test("a set decided on a tiebreak still counts its games", () => {
  assert.deepEqual(
    tennisGamesWon({
      homeScore: 1,
      awayScore: 0,
      homePeriods: [7, 7],
      awayPeriods: [6, 5],
      regulationPeriods: 3,
    }),
    { home: 14, away: 11 },
  );
});

test("a set score with no line scores stays ungraded", () => {
  assert.equal(
    tennisGamesWon({ homeScore: 2, awayScore: 0, regulationPeriods: 3 }),
    null,
  );
});

// The retirement guard. 6-4 2-6 3-1 has the shape of a 2-1 win, but the third
// set never finished: those 3 games are not the bet's game score.
test("a retirement mid-set stays ungraded", () => {
  assert.equal(
    tennisGamesWon({
      homeScore: 1,
      awayScore: 0,
      homePeriods: [6, 2, 3],
      awayPeriods: [4, 6, 1],
      regulationPeriods: 3,
    }),
    null,
  );
});

// Two sets is a finished best-of-three and an abandoned best-of-five, and the
// feed is the only thing that can tell them apart.
test("two sets of a best-of-five stay ungraded", () => {
  const twoSets = {
    homeScore: 1,
    awayScore: 0,
    homePeriods: [6, 6],
    awayPeriods: [4, 3],
  };
  assert.deepEqual(tennisGamesWon({ ...twoSets, regulationPeriods: 3 }), {
    home: 12,
    away: 7,
  });
  assert.equal(tennisGamesWon({ ...twoSets, regulationPeriods: 5 }), null);
  assert.equal(tennisGamesWon(twoSets), null);
});

test("line scores that disagree with the reported winner stay ungraded", () => {
  assert.equal(
    tennisGamesWon({
      homeScore: 0,
      awayScore: 1,
      homePeriods: [6, 6],
      awayPeriods: [4, 3],
      regulationPeriods: 3,
    }),
    null,
  );
});

test("a level or unfinished set stays ungraded", () => {
  assert.equal(
    tennisGamesWon({
      homeScore: 1,
      awayScore: 0,
      homePeriods: [6, 6],
      awayPeriods: [4, 6],
      regulationPeriods: 3,
    }),
    null,
  );
  assert.equal(
    tennisGamesWon({
      homeScore: 1,
      awayScore: 0,
      homePeriods: [6, 5],
      awayPeriods: [4, 3],
      regulationPeriods: 3,
    }),
    null,
  );
});
