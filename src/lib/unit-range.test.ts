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

test("the owner-approved standard range is 0.01 through 10 units", () => {
  assert.equal(playSchema.safeParse({ ...play, units: 0.01 }).success, true);
  assert.equal(playSchema.safeParse({ ...play, units: 10 }).success, true);
  assert.equal(
    createParlaySchema.safeParse({
      units: 10,
      legs: [leg("Lakers"), leg("Celtics")],
    }).success,
    true,
  );
});

test("standard stakes above 10 units are rejected at the server boundary", () => {
  assert.equal(playSchema.safeParse({ ...play, units: 10.01 }).success, false);
  assert.equal(
    createParlaySchema.safeParse({
      units: 10.01,
      legs: [leg("Lakers"), leg("Celtics")],
    }).success,
    false,
  );
});

test("Supermax is a straight-only exact 20u designation", () => {
  assert.equal(
    playSchema.safeParse({ ...play, units: 20, isSupermax: true }).success,
    true,
  );
  assert.equal(
    playSchema.safeParse({ ...play, units: 19.99, isSupermax: true }).success,
    false,
  );
  assert.equal(
    createParlaySchema.safeParse({
      units: 20,
      legs: [leg("Lakers"), leg("Celtics")],
    }).success,
    false,
  );
});
