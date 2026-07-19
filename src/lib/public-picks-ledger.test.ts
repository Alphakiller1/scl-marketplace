import assert from "node:assert/strict";
import test from "node:test";

import type { TodayPick } from "@/lib/mock";
import {
  filterPublicPicks,
  parsePublicPicksLedgerFilters,
  publicPickProofState,
} from "@/lib/public-picks-ledger";
import { buildPublicPicksScopeWhere } from "@/lib/public-picks-scope";

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

test("server scope applies sport, window, and graded predicates before take", () => {
  const now = new Date("2026-07-19T12:00:00.000Z");
  assert.deepEqual(
    buildPublicPicksScopeWhere(
      { window: "7d", sport: "MLB", status: "graded" },
      now,
    ),
    {
      createdAt: { gte: new Date("2026-07-12T12:00:00.000Z") },
      sport: "MLB",
      outcome: { in: ["WIN", "LOSS", "PUSH", "VOID"] },
    },
  );
});

test("server live scope matches the shared five-hour lifecycle window", () => {
  const now = new Date("2026-07-19T12:00:00.000Z");
  assert.deepEqual(
    buildPublicPicksScopeWhere(
      { window: "all", sport: "all", status: "live" },
      now,
    ),
    {
      outcome: "PENDING",
      eventStartsAt: {
        gt: new Date("2026-07-19T07:00:00.000Z"),
        lte: now,
      },
    },
  );
});

test("server ungraded scope excludes only the current live window", () => {
  const now = new Date("2026-07-19T12:00:00.000Z");
  assert.deepEqual(
    buildPublicPicksScopeWhere(
      { window: "all", sport: "all", status: "pending" },
      now,
    ),
    {
      outcome: "PENDING",
      OR: [
        { eventStartsAt: null },
        { eventStartsAt: { gt: now } },
        { eventStartsAt: { lte: new Date("2026-07-19T07:00:00.000Z") } },
      ],
    },
  );
});
