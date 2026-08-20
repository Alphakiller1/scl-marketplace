import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { resolveOutcome, type GradablePlay } from "@/lib/results/match";
import type { SettledGame } from "@/lib/results/settled-game";

const GAMES: SettledGame[] = [
  {
    sport: "NBA",
    home: "Boston Celtics",
    away: "Los Angeles Lakers",
    homeScore: 118,
    awayScore: 104,
    completed: true,
    eventId: "evt-nba-1",
  },
  {
    sport: "MLB",
    home: "New York Yankees",
    away: "Boston Red Sox",
    homeScore: 3,
    awayScore: 7,
    completed: true,
  },
];

function play(p: Partial<GradablePlay>): GradablePlay {
  return {
    id: "p",
    sport: "NBA",
    market: "Moneyline",
    selection: "Celtics",
    oddsAmerican: -110,
    units: 1,
    ...p,
  };
}

test("moneyline: winning team → WIN, losing team → LOSS", () => {
  assert.equal(resolveOutcome(play({ selection: "Celtics" }), GAMES), "WIN");
  assert.equal(resolveOutcome(play({ selection: "Lakers" }), GAMES), "LOSS");
});

test("moneyline resolves the correct sport's game", () => {
  const p = play({ sport: "MLB", market: "ML", selection: "Red Sox" });
  assert.equal(resolveOutcome(p, GAMES), "WIN");
});

test("moneyline prefers eventId join when both sides have it", () => {
  const win = play({
    eventId: "evt-nba-1",
    selection: "Celtics",
    side: "Boston Celtics",
  });
  assert.equal(resolveOutcome(win, GAMES), "WIN");
});

test("totals: over/under vs the combined score, with push on the number", () => {
  const base = { sport: "NBA", market: "Celtics/Lakers Total" };
  assert.equal(
    resolveOutcome(play({ ...base, selection: "Over 210.5" }), GAMES),
    "WIN",
  );
  assert.equal(
    resolveOutcome(play({ ...base, selection: "Under 210.5" }), GAMES),
    "LOSS",
  );
  assert.equal(
    resolveOutcome(play({ ...base, selection: "Over 222" }), GAMES),
    "PUSH",
  );
});

test("spreads: home favorite covers, dog loses", () => {
  assert.equal(
    resolveOutcome(
      play({
        market: "Spread",
        selection: "Boston Celtics -4.5",
        side: "Boston Celtics",
        line: -4.5,
      }),
      GAMES,
    ),
    "WIN",
  );
  assert.equal(
    resolveOutcome(
      play({
        market: "Spread",
        selection: "Los Angeles Lakers +4.5",
        side: "Los Angeles Lakers",
        line: 4.5,
      }),
      GAMES,
    ),
    "LOSS",
  );
});

test("spreads: push when margin lands exactly on the line", () => {
  const pushGame: SettledGame[] = [
    {
      sport: "NBA",
      home: "Boston Celtics",
      away: "Los Angeles Lakers",
      homeScore: 109,
      awayScore: 104,
      completed: true,
    },
  ];
  assert.equal(
    resolveOutcome(
      play({
        market: "Spread",
        selection: "Boston Celtics -5",
        side: "Boston Celtics",
        line: -5,
      }),
      pushGame,
    ),
    "PUSH",
  );
});

test("spreads: parse selection like Team -4.5 when line omitted", () => {
  assert.equal(
    resolveOutcome(
      play({
        market: "Spread",
        selection: "Celtics -4.5",
      }),
      GAMES,
    ),
    "WIN",
  );
});

test("unmatched / ambiguous plays return null (stay pending)", () => {
  assert.equal(resolveOutcome(play({ selection: "Warriors" }), GAMES), null);
  assert.equal(
    resolveOutcome(
      play({ market: "Player Props", selection: "Tatum over 25.5 pts" }),
      GAMES,
    ),
    null,
  );
});

test("All-Star league moneylines resolve via American/National League labels", () => {
  const asg: SettledGame[] = [
    {
      sport: "MLB",
      home: "National League",
      away: "American League",
      homeScore: 0,
      awayScore: 4,
      completed: true,
    },
  ];
  assert.equal(
    resolveOutcome(
      play({
        sport: "MLB",
        market: "Moneyline",
        selection: "American League",
      }),
      asg,
    ),
    "WIN",
  );
  assert.equal(
    resolveOutcome(
      play({
        sport: "MLB",
        market: "Moneyline",
        selection: "National League",
      }),
      asg,
    ),
    "LOSS",
  );
});

test("first-five / innings markets stay deferred", () => {
  assert.equal(
    resolveOutcome(
      play({
        sport: "MLB",
        market: "First Five Innings Total",
        selection: "PHI / PIT u 4.5",
      }),
      GAMES,
    ),
    null,
  );
});

/**
 * Straight plays and parlay legs must decide outcomes in ONE place.
 *
 * They were written out twice and drifted: the parlay branch deferred every
 * prop unconditionally, so a player prop that graded fine on its own sat
 * PENDING forever inside a parlay and held the whole unsettled ticket with it.
 * Both loops now call `resolvePendingPlay`; a second copy of the branch is the
 * regression this catches.
 */
test("both grading loops resolve through the same function", () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), "src/lib/results/auto-grade.ts"),
    "utf8",
  );
  const count = (re: RegExp) => (src.match(re) ?? []).length;

  assert.equal(
    count(/isDeferredProp\(/g),
    1,
    "Only resolvePendingPlay may decide that a play is a deferred prop — a " +
      "second branch is how the parlay path stopped grading props at all.",
  );
  assert.equal(
    count(/await resolvePendingPlay\(/g),
    2,
    "Straight plays and parlay legs must each resolve through " +
      "resolvePendingPlay, so neither can drift from the other.",
  );
  assert.equal(
    count(/resolveOutcome\(boundPlay, games\)/g),
    1,
    "resolveOutcome grades against the FULL-GAME score; reaching it from a " +
      "second place is how a prop or period market gets a wrong result.",
  );
  assert.match(src, /MAX_GRADE_ROUNDS/);
  assert.match(src, /ensureClosingAndClv/);
  assert.match(src, /attemptedPlayIds/);
  assert.match(src, /straightTargets\.map\(\(play\) => play\.id\)/);
  assert.match(src, /legTargets\.map\(\(play\) => play\.id\)/);
  assert.equal(
    count(/eventLabel: true/g),
    2,
    "Straight plays and parlay legs must both load the board fixture label " +
      "needed to match ESPN when the primary results provider is unavailable.",
  );
});
