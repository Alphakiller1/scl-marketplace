import assert from "node:assert/strict";
import test from "node:test";

import type { TodayPick } from "@/lib/mock";
import {
  filterPublicPicks,
  parsePublicPicksLedgerFilters,
  publicPickProofState,
} from "@/lib/public-picks-ledger";

function pick(overrides: Partial<TodayPick>): TodayPick {
  return {
    id: "pick-1",
    capper: {
      id: "capper-1",
      name: "Public capper",
      handle: "publiccapper",
      displayName: null,
      verified: false,
    },
    capperRecord: { w: 1, l: 1, p: 0 },
    sport: "NBA",
    event: "Sides",
    selection: "New York +3.5",
    oddsAmerican: -110,
    units: 1,
    status: "pre-game",
    postedAt: new Date("2026-07-18T12:00:00.000Z"),
    gameTime: "Pending",
    verificationTier: "VERIFIED",
    ...overrides,
  };
}

test("parsePublicPicksLedgerFilters rejects unsupported query values", () => {
  assert.deepEqual(
    parsePublicPicksLedgerFilters({
      window: "season",
      status: "won",
      sport: "<script>",
    }),
    { window: "all", status: "all", sport: "all" },
  );
});

test("filterPublicPicks combines bounded time, sport, and graded status", () => {
  const rows = [
    pick({ id: "recent-win", status: "win" }),
    pick({
      id: "old-win",
      status: "win",
      postedAt: new Date("2026-06-01T12:00:00.000Z"),
    }),
    pick({ id: "recent-live", status: "live" }),
    pick({ id: "recent-mlb", sport: "MLB", status: "loss" }),
  ];

  assert.deepEqual(
    filterPublicPicks(
      rows,
      { window: "7d", sport: "NBA", status: "graded" },
      new Date("2026-07-19T12:00:00.000Z"),
    ).map((row) => row.id),
    ["recent-win"],
  );
});

test("verified remains submission proof and does not override settlement", () => {
  assert.equal(publicPickProofState(pick({ status: "pre-game" })), "captured");
  assert.equal(publicPickProofState(pick({ status: "loss" })), "loss");
  assert.equal(
    publicPickProofState(
      pick({ status: "pre-game", verificationTier: "SELF_REPORTED" }),
    ),
    "pending",
  );
});
