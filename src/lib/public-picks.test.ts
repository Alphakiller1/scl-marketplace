import assert from "node:assert/strict";
import test from "node:test";

import type { CapperSummary } from "@/lib/mock";
import {
  joinPlaysToPublicPicks,
  publicFeedCappers,
  type PublicPlayJoinRow,
} from "@/lib/public-picks";

function capper(
  overrides: Partial<CapperSummary> & Pick<CapperSummary, "id" | "handle">,
): CapperSummary {
  return {
    name: overrides.handle,
    verified: true,
    topSport: "MLB",
    rank: 0,
    rankDelta: 0,
    record: { w: 0, l: 0, p: 0 },
    winPct: 0,
    units: 0,
    roi: 0,
    streak: 0,
    recentForm: [],
    trophies: [],
    settledPicks: 0,
    ...overrides,
  };
}

function play(
  overrides: Partial<PublicPlayJoinRow> &
    Pick<PublicPlayJoinRow, "id" | "capperId">,
): PublicPlayJoinRow {
  return {
    sport: "MLB",
    league: "MLB",
    market: "Moneyline",
    selection: "Yankees",
    oddsAmerican: -120,
    units: 1,
    outcome: "PENDING",
    profitUnits: null,
    eventStartsAt: null,
    createdAt: new Date("2026-07-13T12:00:00Z"),
    verificationTier: "VERIFIED",
    side: "Yankees",
    ...overrides,
  };
}

test("publicFeedCappers concatenates ranked and unranked without dropping either", () => {
  const ranked = [capper({ id: "r1", handle: "ranked", rank: 1 })];
  const unranked = [capper({ id: "u1", handle: "building", rank: 0 })];
  assert.deepEqual(
    publicFeedCappers(ranked, unranked).map((c) => c.id),
    ["r1", "u1"],
  );
  assert.deepEqual(
    publicFeedCappers(ranked).map((c) => c.id),
    ["r1"],
  );
});

test("joinPlaysToPublicPicks includes Building-a-Record cappers when supplied", () => {
  const ranked = [
    capper({
      id: "r1",
      handle: "ranked",
      rank: 1,
      name: "Ranked Cap",
      settledPicks: 12,
    }),
  ];
  const unranked = [
    capper({
      id: "u1",
      handle: "newbie",
      rank: 0,
      name: "Building Cap",
      displayName: "Building Cap",
      settledPicks: 0,
    }),
  ];
  const picks = joinPlaysToPublicPicks(
    [
      play({ id: "p-unranked", capperId: "u1", selection: "Dodgers ML" }),
      play({ id: "p-ranked", capperId: "r1", selection: "Cubs ML" }),
    ],
    publicFeedCappers(ranked, unranked),
  );

  assert.deepEqual(
    picks.map((p) => ({
      id: p.id,
      handle: p.capper.handle,
      rank: p.capperRank,
      settled: p.capperSettledPicks,
    })),
    [
      { id: "p-unranked", handle: "newbie", rank: 0, settled: 0 },
      { id: "p-ranked", handle: "ranked", rank: 1, settled: 12 },
    ],
  );
});

test("joinPlaysToPublicPicks drops plays when only ranked cappers are passed", () => {
  const ranked = [capper({ id: "r1", handle: "ranked", rank: 1 })];
  const picks = joinPlaysToPublicPicks(
    [
      play({ id: "p-unranked", capperId: "u1" }),
      play({ id: "p-ranked", capperId: "r1" }),
    ],
    publicFeedCappers(ranked, []),
  );

  assert.deepEqual(
    picks.map((p) => p.id),
    ["p-ranked"],
  );
});

test("joinPlaysToPublicPicks never surfaces email as display identity", () => {
  const cappers = [
    capper({
      id: "u1",
      handle: "safehandle",
      name: "safehandle",
      displayName: null,
    }),
  ];
  const [pick] = joinPlaysToPublicPicks(
    [play({ id: "p1", capperId: "u1" })],
    cappers,
  );
  assert.equal(pick.capper.handle, "safehandle");
  assert.equal(pick.capper.displayName, null);
  assert.ok(!String(pick.capper.name).includes("@"));
});

test("joinPlaysToPublicPicks scrubs a pending selection before its release", () => {
  const now = new Date("2026-08-04T22:00:00.000Z");
  const [pick] = joinPlaysToPublicPicks(
    [
      play({
        id: "sealed",
        capperId: "u1",
        selection: "Yankees -1.5",
        side: "Yankees",
        oddsAmerican: -110,
        book: "draftkings",
        notes: "Private paid analysis",
        eventStartsAt: new Date("2026-08-04T23:00:00.000Z"),
      }),
    ],
    [capper({ id: "u1", handle: "safehandle" })],
    now,
  );

  assert.equal(pick.isEmbargoed, true);
  assert.equal(pick.selection, "Pick hidden");
  assert.equal(pick.oddsAmerican, 0);
  assert.equal(pick.side, null);
  assert.equal(pick.book, null);
  assert.equal(pick.notes, null);
  assert.equal(JSON.stringify(pick).includes("Yankees -1.5"), false);
  assert.equal(JSON.stringify(pick).includes("Private paid analysis"), false);
});

test("joinPlaysToPublicPicks reveals a pending selection at the release time", () => {
  const start = new Date("2026-08-04T23:00:00.000Z");
  const [pick] = joinPlaysToPublicPicks(
    [play({ id: "released", capperId: "u1", eventStartsAt: start })],
    [capper({ id: "u1", handle: "safehandle" })],
    new Date("2026-08-05T00:30:00.000Z"),
  );

  assert.equal(pick.isEmbargoed, false);
  assert.equal(pick.selection, "Yankees");
  assert.equal(pick.oddsAmerican, -120);
});
