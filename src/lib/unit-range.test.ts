import assert from "node:assert/strict";
import test from "node:test";

import { playSchema } from "@/lib/schemas/play.schema";
import { createParlaySchema } from "@/lib/schemas/parlay.schema";

const play = {
  sport: "NBA",
  market: "Moneyline",
  selection: "Lakers",
  oddsAmerican: -110,
  units: 100_000_000,
};

const leg = (side: string) => ({
  sport: "NBA",
  market: "Moneyline",
  selection: side,
  side,
  oddsAmerican: -110,
  eventId: "event-1",
  eventLabel: "Lakers at Celtics",
  eventStartsAt: "2026-08-10T00:00:00.000Z",
  book: "draftkings",
});

test("a capper can manually enter exactly 100,000,000 units", () => {
  assert.equal(playSchema.safeParse(play).success, true);
  assert.equal(
    createParlaySchema.safeParse({
      units: 100_000_000,
      legs: [leg("Lakers"), leg("Celtics")],
    }).success,
    true,
  );
});

test("stakes above 100,000,000 remain rejected at the server boundary", () => {
  assert.equal(
    playSchema.safeParse({ ...play, units: 100_000_000.25 }).success,
    false,
  );
  assert.equal(
    createParlaySchema.safeParse({
      units: 100_000_000.25,
      legs: [leg("Lakers"), leg("Celtics")],
    }).success,
    false,
  );
});
