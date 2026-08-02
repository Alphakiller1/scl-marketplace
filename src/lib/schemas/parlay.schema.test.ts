import assert from "node:assert/strict";
import test from "node:test";

import { createParlaySchema } from "@/lib/schemas/parlay.schema";

function leg(book: string) {
  return {
    sport: "NBA",
    market: "Moneyline",
    selection: "Lakers",
    oddsAmerican: -110,
    eventId: `event-${book}`,
    eventLabel: "Lakers at Celtics",
    eventStartsAt: "2026-08-05T23:00:00.000Z",
    side: "Lakers",
    book,
  };
}

test("parlay schema accepts one sportsbook across every leg", () => {
  assert.equal(
    createParlaySchema.safeParse({
      units: 1,
      legs: [leg("draftkings"), { ...leg("draftkings"), side: "Celtics" }],
    }).success,
    true,
  );
});

test("parlay schema rejects mixed sportsbooks at the server boundary", () => {
  const result = createParlaySchema.safeParse({
    units: 1,
    legs: [leg("draftkings"), leg("fanduel")],
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(result.error.issues[0]?.message ?? "", /same sportsbook/i);
  }
});
