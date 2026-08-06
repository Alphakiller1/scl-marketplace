import assert from "node:assert/strict";
import { test } from "node:test";

import { mergeSettledGames } from "@/lib/results/settled-game";
import { findGame, type GradablePlay } from "@/lib/results/match";
import type { SettledGame } from "@/lib/results/settled-game";

const game = (over: Partial<SettledGame>): SettledGame => ({
  sport: "MLB",
  home: "Cincinnati Reds",
  away: "Athletics",
  homeScore: 3,
  awayScore: 2,
  completed: true,
  startsAt: new Date("2026-08-05T22:40:00Z"),
  ...over,
});

test("the same fixture from both providers collapses to one", () => {
  // The Odds API issues a hash, ESPN a numeric id. Keying on eventId meant
  // neither ever matched the other and every game appeared twice.
  const oddsApi = game({ eventId: "3b23ade05c9d38068df5e7af422bca05" });
  const espn = game({ eventId: "401816405" });

  const merged = mergeSettledGames([oddsApi], [espn]);
  assert.equal(merged.length, 1);
  // Primary wins: it carries the id that event-bound plays match on.
  assert.equal(merged[0]!.eventId, "3b23ade05c9d38068df5e7af422bca05");
});

test("a duplicated fixture no longer makes every name match ambiguous", () => {
  const merged = mergeSettledGames(
    [game({ eventId: "odds-api-hash" })],
    [game({ eventId: "espn-numeric" })],
  );
  // An imported legacy pick carries no eventId and is matched by name.
  const play: GradablePlay = {
    id: "p1",
    sport: "MLB",
    market: "Moneyline",
    selection: "Cincinnati Reds",
    oddsAmerican: -150,
    units: 1,
    createdAt: new Date("2026-08-05T22:40:00Z"),
  };
  assert.equal(findGame(play, merged)?.eventId, "odds-api-hash");
});

test("the backstop's copy survives when only it has the game", () => {
  const espnOnly = game({ eventId: "401816405" });
  const merged = mergeSettledGames([], [espnOnly]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]!.eventId, "401816405");
});

test("genuinely different fixtures are kept apart", () => {
  const monday = game({
    eventId: "a",
    startsAt: new Date("2026-08-04T22:40:00Z"),
  });
  const tuesday = game({
    eventId: "b",
    startsAt: new Date("2026-08-05T22:40:00Z"),
  });
  const other = game({
    eventId: "c",
    home: "Chicago Cubs",
    away: "Los Angeles Dodgers",
  });
  assert.equal(mergeSettledGames([monday, tuesday, other], []).length, 3);
});
