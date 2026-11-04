import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalNcaabTeamName } from "@/lib/results/ncaab-team-names";
import {
  findGame,
  resolveOutcome,
  type GradablePlay,
} from "@/lib/results/match";
import {
  mergeSettledGames,
  type SettledGame,
} from "@/lib/results/settled-game";

const aliases = [
  ["Appalachian St Mountaineers", "App State Mountaineers"],
  ["Murray St Racers", "Murray State Racers"],
  ["San José St Spartans", "San José State Spartans"],
  ["Georgia St Panthers", "Georgia State Panthers"],
  ["Mt. St. Mary's Mountaineers", "Mount St. Mary's Mountaineers"],
  ["Loyola (MD) Greyhounds", "Loyola Maryland Greyhounds"],
  ["American Eagles", "American University Eagles"],
  ["Arkansas-Little Rock Trojans", "Little Rock Trojans"],
  ["Central Connecticut St Blue Devils", "Central Connecticut Blue Devils"],
  ["Boston Univ. Terriers", "Boston University Terriers"],
  ["Wright St Raiders", "Wright State Raiders"],
  ["Indiana St Sycamores", "Indiana State Sycamores"],
];

test("production college school aliases keep the full school and mascot identity", () => {
  for (const [oddsName, espnName] of aliases) {
    assert.equal(
      canonicalNcaabTeamName(oddsName),
      canonicalNcaabTeamName(espnName),
      oddsName,
    );
  }
  for (const [left, right] of [
    ["Georgia Bulldogs", "Gonzaga Bulldogs"],
    ["Loyola Maryland Greyhounds", "Loyola Marymount Lions"],
    ["Miami (OH) RedHawks", "Miami Hurricanes"],
    ["Michigan Wolverines", "Michigan State Spartans"],
  ]) {
    assert.notEqual(
      canonicalNcaabTeamName(left),
      canonicalNcaabTeamName(right),
    );
  }
});

test("each school alias settles its bound play and merges provider copies without matching another school", () => {
  for (const [oddsName, espnName] of aliases) {
    const startsAt = new Date("2026-11-02T23:00:00Z");
    const final: SettledGame = {
      sport: "NCAAB",
      home: espnName,
      away: "Example College Eagles",
      homeScore: 80,
      awayScore: 60,
      completed: true,
      eventId: "espn:correct",
      startsAt,
    };
    const pick: GradablePlay = {
      id: "pending",
      sport: "NCAAB",
      market: "Spread",
      selection: `${oddsName} -7.5`,
      eventLabel: `Example College Eagles @ ${oddsName}`,
      eventStartsAt: startsAt,
      eventId: "odds:correct",
      oddsAmerican: -110,
      units: 1,
    };
    assert.equal(findGame(pick, [final]), final, oddsName);
    assert.equal(resolveOutcome(pick, [final]), "WIN", oddsName);
    assert.equal(
      findGame(pick, [{ ...final, home: "Unrelated College Eagles" }]),
      null,
      oddsName,
    );
    const merged = mergeSettledGames(
      [{ ...final, home: oddsName, eventId: "odds:correct" }],
      [final],
    );
    assert.equal(merged.length, 1, oddsName);
    assert.equal(merged[0].espnEventId, "correct");
  }
});
