import assert from "node:assert/strict";
import test from "node:test";

import { parseEventBoardSnapshot } from "@/lib/odds-event-board-contract";

const selection = {
  label: "Away +1.5 (F5 Spread)",
  market: "1st 5 Innings Spread",
  selection: "Away +1.5 (F5 Spread)",
  side: "Away",
  line: 1.5,
  oddsAmerican: -105,
  book: "fanduel",
};

test("accepts a populated last-good event board for the exact event", () => {
  const snapshot = {
    version: 1,
    sport: "MLB",
    eventId: "event-1",
    selections: [selection],
    savedAt: Date.now(),
  };
  assert.deepEqual(
    parseEventBoardSnapshot(snapshot, "MLB", "event-1"),
    snapshot,
  );
});

test("rejects empty, malformed, or cross-event snapshots", () => {
  const base = {
    version: 1,
    sport: "MLB",
    eventId: "event-1",
    selections: [selection],
    savedAt: Date.now(),
  };
  assert.equal(
    parseEventBoardSnapshot({ ...base, selections: [] }, "MLB", "event-1"),
    null,
  );
  assert.equal(parseEventBoardSnapshot(base, "MLB", "event-2"), null);
  assert.equal(
    parseEventBoardSnapshot(
      { ...base, selections: [{ market: "Spread" }] },
      "MLB",
      "event-1",
    ),
    null,
  );
});
