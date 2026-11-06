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
  ["Fort Wayne Mastodons", "Purdue Fort Wayne Mastodons"],
  ["IPFW Mastodons", "Purdue Fort Wayne Mastodons"],
  ["New Orleans Privateers", "LSU New Orleans Privateers"],
  ["Cal Baptist Lancers", "California Baptist Lancers"],
  ["CS Fullerton Titans", "Cal State Fullerton Titans"],
  ["CSU Fullerton Titans", "Cal State Fullerton Titans"],
  ["California State Fullerton Titans", "Cal State Fullerton Titans"],
  ["CSU Northridge Matadors", "Cal State Northridge Matadors"],
  ["LIU Sharks", "Long Island University Sharks"],
  ["Albany Great Danes", "UAlbany Great Danes"],
];

test("the final four overdue college fixtures resolve with both opponents bound", () => {
  for (const [away, home, espnAway, espnHome] of [
    [
      "Fort Wayne Mastodons",
      "Duquesne Dukes",
      "Purdue Fort Wayne Mastodons",
      "Duquesne Dukes",
    ],
    [
      "New Orleans Privateers",
      "LSU Tigers",
      "LSU New Orleans Privateers",
      "LSU Tigers",
    ],
    [
      "North Florida Ospreys",
      "Cal Baptist Lancers",
      "North Florida Ospreys",
      "California Baptist Lancers",
    ],
    [
      "CS Fullerton Titans",
      "San Diego St Aztecs",
      "Cal State Fullerton Titans",
      "San Diego State Aztecs",
    ],
  ]) {
    const startsAt = new Date("2026-11-04T01:00:00Z");
    const final: SettledGame = {
      sport: "NCAAB",
      home: espnHome,
      away: espnAway,
      homeScore: 91,
      awayScore: 62,
      completed: true,
      startsAt,
      eventId: "espn:final",
    };
    const pick: GradablePlay = {
      id: "pending",
      sport: "NCAAB",
      market: "Spread",
      selection: `${home} -12.5`,
      eventLabel: `${away} @ ${home}`,
      eventStartsAt: startsAt,
      eventId: "odds:fixture",
      oddsAmerican: -110,
      units: 1,
    };
    assert.equal(resolveOutcome(pick, [final]), "WIN", pick.eventLabel ?? "");
    assert.equal(
      resolveOutcome({ ...pick, selection: "Under 160", market: "Total" }, [
        final,
      ]),
      "WIN",
    );
    assert.equal(
      findGame(pick, [{ ...final, away: "Unrelated Eagles" }]),
      null,
    );
  }
});

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
