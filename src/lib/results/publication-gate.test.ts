import assert from "node:assert/strict";
import test from "node:test";

import type { GradablePlay } from "@/lib/results/match";
import {
  minGameMinutes,
  publicationVerdict,
} from "@/lib/results/publication-gate";
import {
  mergeSettledGames,
  reportsOf,
  type SettledGame,
} from "@/lib/results/settled-game";

const at = (iso: string) => new Date(iso);

function play(
  sport: string,
  eventStartsAt: string,
): Pick<GradablePlay, "sport" | "eventStartsAt"> {
  return { sport, eventStartsAt: at(eventStartsAt) };
}

/** The Bucs–Browns final as each feed reported it on 2026-09-20. */
function bucs(
  source: "espn" | "sportspuff",
  bucsScore: number,
  brownsScore: number,
): SettledGame {
  return {
    sport: "NFL",
    home: "Tampa Bay Buccaneers",
    away: "Cleveland Browns",
    homeScore: bucsScore,
    awayScore: brownsScore,
    completed: true,
    eventId:
      source === "espn" ? "espn:401872935" : "sportspuff:20260920_CLE@TB",
    startsAt: at("2026-09-20T17:00:00Z"),
  };
}

test("a college football final 94 minutes after kickoff is refused", () => {
  // Production: four Rutgers spreads settled at 00:34Z on a 23:00Z kickoff.
  const rutgers: SettledGame = {
    sport: "NCAAF",
    home: "Rutgers Scarlet Knights",
    away: "Howard Bison",
    homeScore: 41,
    awayScore: 7,
    completed: true,
    eventId: "espn:401858468",
    startsAt: at("2026-09-25T23:00:00Z"),
  };
  const verdict = publicationVerdict(
    play("NCAAF", "2026-09-25T23:00:00Z"),
    rutgers,
    at("2026-09-26T00:34:32Z"),
  );
  assert.equal(verdict.ok, false);
  assert.equal(!verdict.ok && verdict.block, "too_early");
});

test("the floor runs from the later kickoff when weather delays the game", () => {
  // Mississippi State–South Carolina: slip 20:15Z, actual kickoff 21:35Z.
  const game: SettledGame = {
    sport: "NCAAF",
    home: "South Carolina Gamecocks",
    away: "Mississippi State Bulldogs",
    homeScore: 34,
    awayScore: 41,
    completed: true,
    eventId: "espn:401856691",
    startsAt: at("2026-09-19T21:35:00Z"),
  };
  const slip = play("NCAAF", "2026-09-19T20:15:00Z");
  // 170 minutes after the slip time, but only 90 after the real kickoff.
  assert.equal(
    publicationVerdict(slip, game, at("2026-09-19T23:05:00Z")).ok,
    false,
  );
  assert.equal(
    publicationVerdict(slip, game, at("2026-09-20T01:00:00Z")).ok,
    true,
  );
});

test("a backstop feed alone cannot settle a game", () => {
  // The Bucs misgrade: a third-quarter 16-6 reported final by the backstop
  // while ESPN had not finished the game.
  const verdict = publicationVerdict(
    play("NFL", "2026-09-20T17:00:00Z"),
    bucs("sportspuff", 16, 6),
    at("2026-09-20T20:44:50Z"),
  );
  assert.equal(verdict.ok, false);
  assert.equal(!verdict.ok && verdict.block, "unconfirmed_source");
});

test("feeds that disagree on the score hold the grade", () => {
  const [merged] = mergeSettledGames(
    [bucs("espn", 19, 23)],
    [bucs("sportspuff", 16, 6)],
  );
  assert.deepEqual(
    reportsOf(merged!).map((r) => r.source),
    ["sportspuff", "espn"],
  );
  const verdict = publicationVerdict(
    play("NFL", "2026-09-20T17:00:00Z"),
    merged!,
    at("2026-09-20T20:44:50Z"),
  );
  assert.equal(verdict.ok, false);
  assert.equal(!verdict.ok && verdict.block, "sources_disagree");
});

test("a stale backstop cannot hold a primary final forever", () => {
  const [merged] = mergeSettledGames(
    [bucs("espn", 19, 23)],
    [bucs("sportspuff", 16, 6)],
  );
  assert.equal(
    publicationVerdict(
      play("NFL", "2026-09-20T17:00:00Z"),
      merged!,
      at("2026-09-20T23:30:00Z"),
    ).ok,
    true,
  );
});

test("primary feeds that disagree never publish, however late", () => {
  const espn = bucs("espn", 19, 23);
  const odds: SettledGame = {
    ...espn,
    homeScore: 26,
    eventId: "0636ebff776d43f8c829a36713c80b22",
  };
  const [merged] = mergeSettledGames([odds], [espn]);
  const verdict = publicationVerdict(
    play("NFL", "2026-09-20T17:00:00Z"),
    merged!,
    at("2026-09-22T17:00:00Z"),
  );
  assert.equal(!verdict.ok && verdict.block, "sources_disagree");
});

test("agreeing feeds publish once the game can be over", () => {
  const [merged] = mergeSettledGames(
    [bucs("espn", 19, 23)],
    [bucs("sportspuff", 19, 23)],
  );
  assert.equal(
    publicationVerdict(
      play("NFL", "2026-09-20T17:00:00Z"),
      merged!,
      at("2026-09-20T20:44:50Z"),
    ).ok,
    true,
  );
});

test("nested composites keep every feed's report", () => {
  const official = bucs("espn", 19, 23);
  const inner = mergeSettledGames([], [bucs("sportspuff", 19, 23)]);
  const outer = mergeSettledGames([official], inner);
  assert.equal(outer.length, 1);
  assert.equal(reportsOf(outer[0]!).length, 2);
});

test("MMA has no floor: a fight can end in seconds", () => {
  assert.equal(minGameMinutes("MMA"), 0);
  assert.ok(minGameMinutes("NCAAF") >= 150);
  assert.ok(minGameMinutes("MLB") <= 90, "rain-shortened games still settle");
});
