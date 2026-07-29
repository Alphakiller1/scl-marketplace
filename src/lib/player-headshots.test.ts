import assert from "node:assert/strict";
import test from "node:test";

import {
  extractPlayerName,
  toHeadshotLeague,
  resolvePlayerHeadshot,
} from "@/lib/player-headshots";

test("extractPlayerName pulls the athlete out of prop selections", () => {
  // Seeded + board shapes.
  assert.equal(extractPlayerName("Aaron Judge Over 1.5 RBIs"), "Aaron Judge");
  assert.equal(
    extractPlayerName("A'ja Wilson Under 22.5 Points"),
    "A'ja Wilson",
  );
  // Feed variant with a dashed market segment.
  assert.equal(
    extractPlayerName("Shohei Ohtani - Home Runs Over 0.5"),
    "Shohei Ohtani",
  );
  // Accented + suffixed names survive.
  assert.equal(
    extractPlayerName("Vladimir Guerrero Jr. Over 1.5 Total Bases"),
    "Vladimir Guerrero Jr.",
  );
  assert.equal(
    extractPlayerName("José Ramírez Under 1.5 Hits"),
    "José Ramírez",
  );
});

test("extractPlayerName refuses non-player selections", () => {
  // Team totals / game lines must never resolve to a person.
  assert.equal(extractPlayerName("Dodgers/Padres Over 8.5"), null);
  assert.equal(extractPlayerName("Yankees -1.5"), null);
  assert.equal(extractPlayerName("Aces ML"), null);
  assert.equal(extractPlayerName("Aces Team Over 45.5"), null);
  assert.equal(extractPlayerName("Liberty Moneyline"), null);
  assert.equal(extractPlayerName(""), null);
  assert.equal(extractPlayerName(null), null);
  assert.equal(extractPlayerName(undefined), null);
});

test("league mapping + curated fast path", () => {
  assert.equal(toHeadshotLeague("MLB"), "mlb");
  assert.equal(toHeadshotLeague("WNBA"), "wnba");
  assert.equal(toHeadshotLeague("NBA"), undefined);
  assert.equal(toHeadshotLeague(null), undefined);
  // Curated entries still short-circuit the network lookup.
  assert.equal(resolvePlayerHeadshot("Aaron Judge", "mlb")?.espnId, "33192");
  assert.equal(resolvePlayerHeadshot("Dodgers/Padres Over 8.5"), null);
});
