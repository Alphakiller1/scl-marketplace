import assert from "node:assert/strict";
import test from "node:test";

import { playSchema } from "@/lib/schemas/play.schema";
import { createParlaySchema } from "@/lib/schemas/parlay.schema";

const play = {
  sport: "NBA",
  market: "Moneyline",
  selection: "Lakers",
  oddsAmerican: -110,
  units: 5,
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

test("the owner-approved maximum is exactly 5 units", () => {
  assert.equal(playSchema.safeParse(play).success, true);
  assert.equal(
    createParlaySchema.safeParse({
      units: 5,
      legs: [leg("Lakers"), leg("Celtics")],
    }).success,
    true,
  );
});

test("stakes above 5 units are rejected at the server boundary", () => {
  assert.equal(playSchema.safeParse({ ...play, units: 5.01 }).success, false);
  assert.equal(
    createParlaySchema.safeParse({
      units: 5.01,
      legs: [leg("Lakers"), leg("Celtics")],
    }).success,
    false,
  );
});
