import assert from "node:assert/strict";
import test from "node:test";

import {
  legacyOddsEventIdentity,
  oddsEventIdentityFromBoard,
  oddsEventIdentityKey,
  parseOddsEventIdentity,
} from "@/lib/odds-event-identity-contract";

test("event identity snapshot preserves provider hash, fixture and start", () => {
  const snapshot = oddsEventIdentityFromBoard(
    {
      id: "event-hash",
      sport: "MLB",
      home: "Miami Marlins",
      away: "Pittsburgh Pirates",
      commenceTime: "2026-08-11T22:41:00Z",
    },
    123,
  );
  assert.equal(
    oddsEventIdentityKey("mlb", "event-hash"),
    "event-identity:v1:MLB:event-hash",
  );
  assert.deepEqual(
    parseOddsEventIdentity(snapshot, "MLB", "event-hash"),
    snapshot,
  );
  assert.equal(parseOddsEventIdentity(snapshot, "WNBA", "event-hash"), null);
  assert.equal(
    parseOddsEventIdentity(
      { ...snapshot, commenceTime: "not-a-date" },
      "MLB",
      "event-hash",
    ),
    null,
  );
});

test("verified legacy board capture maps simultaneous games by immutable id", () => {
  assert.deepEqual(
    legacyOddsEventIdentity("MLB", "bd7e76db673b0ad81d62b744ba2d18d1"),
    {
      version: 1,
      sport: "MLB",
      eventId: "bd7e76db673b0ad81d62b744ba2d18d1",
      away: "Cincinnati Reds",
      home: "Chicago White Sox",
      commenceTime: "2026-08-11T23:41:00Z",
      savedAt: Date.parse("2026-08-10T23:26:15.732Z"),
    },
  );
  assert.equal(legacyOddsEventIdentity("MLB", "unknown"), null);
});
