import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  manualGradingReason,
  needsManualGrading,
} from "@/lib/results/manual-grading";

const NOW = new Date("2026-08-22T18:00:00Z");
const FINISHED = new Date("2026-08-17T15:00:00Z"); // days before NOW
const LIVE = new Date("2026-08-22T17:30:00Z"); // 30 min ago

describe("needsManualGrading", () => {
  // The exact play that sat five days: a tennis games spread the grader
  // refuses AND the overdue alert excludes, so nothing ever asked a human.
  it("claims a finished tennis spread", () => {
    assert.equal(
      needsManualGrading(
        { sport: "TENNIS", market: "Spread", eventStartsAt: FINISHED },
        NOW,
      ),
      true,
    );
  });

  it("claims a finished tennis total", () => {
    assert.equal(
      needsManualGrading(
        { sport: "TENNIS", market: "Total", eventStartsAt: FINISHED },
        NOW,
      ),
      true,
    );
  });

  // A tennis moneyline grades itself — it must never reach the queue, or the
  // queue fills with work nobody needs to do and stops being read.
  it("leaves a tennis moneyline alone", () => {
    assert.equal(
      needsManualGrading(
        { sport: "TENNIS", market: "Moneyline", eventStartsAt: FINISHED },
        NOW,
      ),
      false,
    );
  });

  // Listing live games would train people to ignore the queue.
  it("waits for the expected final before claiming a match", () => {
    assert.equal(
      needsManualGrading(
        { sport: "TENNIS", market: "Spread", eventStartsAt: LIVE },
        NOW,
      ),
      false,
    );
  });

  it("ignores sports the grader can settle", () => {
    for (const sport of ["MLB", "NFL", "SOCCER", "WNBA", "MMA"]) {
      assert.equal(
        needsManualGrading(
          { sport, market: "Spread", eventStartsAt: FINISHED },
          NOW,
        ),
        false,
        `${sport} spreads auto-grade`,
      );
    }
  });

  it("cannot claim a play with no start time", () => {
    assert.equal(
      needsManualGrading(
        { sport: "TENNIS", market: "Spread", eventStartsAt: null },
        NOW,
      ),
      false,
    );
  });
});

describe("manualGradingReason", () => {
  it("names the missing game score for tennis", () => {
    // The games markets settle themselves now, from the per-set line scores.
    // What still reaches this queue is a match the feed reported without them.
    assert.match(
      manualGradingReason({ sport: "TENNIS", market: "Spread" }),
      /per-set game score/,
    );
  });

  it("falls back to a generic reason", () => {
    assert.match(
      manualGradingReason({ sport: "PGA", market: "Outright" }),
      /not auto-gradeable for PGA/,
    );
  });
});
