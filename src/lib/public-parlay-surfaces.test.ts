import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import type { CapperSummary } from "./mock";
import {
  earliestLegStart,
  parlayBookLabel,
  parlayDisplaySport,
  parlayGameLabel,
  parlayTitle,
  parlayVerificationTier,
} from "./parlay-display";
import {
  joinParlaysToPublicPicks,
  joinPlaysToPublicPicks,
  mergePublicPicks,
  type PublicParlayJoinRow,
} from "./public-picks";
import { buildPublicParlayScopeWhere } from "./public-picks-scope";

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const capper: CapperSummary = {
  id: "capper-1",
  name: "Wise Gentlemen",
  handle: "wisegentlemensports_parlay",
  verified: true,
  topSport: "MLB",
  rank: 4,
  rankDelta: 0,
  streak: 3,
  recentForm: ["W", "W", "L"],
  trophies: [],
  record: { w: 5, l: 2, p: 0 },
  winPct: 71.4,
  units: 6.3,
  roi: 12.2,
  settledPicks: 7,
};

function leg(overrides: Partial<PublicParlayJoinRow["legs"][number]> = {}) {
  return {
    id: "leg-1",
    sport: "MLB",
    league: "MLB",
    market: "Moneyline",
    selection: "Yankees ML",
    oddsAmerican: -175,
    side: "Yankees",
    book: "draftkings",
    eventLabel: "Red Sox @ Yankees",
    homeTeam: "Yankees",
    awayTeam: "Red Sox",
    eventStartsAt: new Date("2026-08-23T23:05:00Z"),
    verificationTier: "VERIFIED" as const,
    ...overrides,
  };
}

function parlayRow(
  overrides: Partial<PublicParlayJoinRow> = {},
): PublicParlayJoinRow {
  return {
    id: "parlay-1",
    capperId: capper.id,
    combinedOddsAmerican: 121,
    units: 3,
    outcome: "WIN",
    profitUnits: 3.64,
    createdAt: new Date("2026-08-23T17:35:00Z"),
    legs: [
      leg(),
      leg({
        id: "leg-2",
        selection: "Dodgers ML",
        side: "Dodgers",
        eventLabel: "Padres @ Dodgers",
        homeTeam: "Dodgers",
        awayTeam: "Padres",
        eventStartsAt: new Date("2026-08-23T22:10:00Z"),
      }),
    ],
    ...overrides,
  };
}

test("a parlay joins the public feed as one position of record", () => {
  const [pick] = joinParlaysToPublicPicks([parlayRow()], [capper]);

  assert.equal(pick?.selection, "2-Leg Parlay");
  assert.equal(pick?.market, "Parlay");
  assert.equal(pick?.oddsAmerican, 121);
  assert.equal(pick?.units, 3);
  assert.equal(pick?.profitUnits, 3.64);
  assert.equal(pick?.status, "win");
  assert.equal(pick?.parlay?.legs.length, 2);
  // Lifecycle anchors to the first game, not the last.
  assert.equal(pick?.eventStartsAt?.toISOString(), "2026-08-23T22:10:00.000Z");
  // A parlay has no single closing price, so CLV stays empty rather than 0.
  assert.equal(pick?.clvPts, null);
  assert.equal(pick?.closingOddsAmerican, null);
});

test("one self-reported leg makes the whole ticket self-reported", () => {
  const [pick] = joinParlaysToPublicPicks(
    [
      parlayRow({
        legs: [leg(), leg({ id: "leg-2", verificationTier: "SELF_REPORTED" })],
      }),
    ],
    [capper],
  );

  assert.equal(pick?.verificationTier, "SELF_REPORTED");
});

test("a pending parlay seals its legs and price until the embargo lifts", () => {
  const now = new Date("2026-08-23T21:00:00Z");
  const [pick] = joinParlaysToPublicPicks(
    [parlayRow({ outcome: "PENDING", profitUnits: null })],
    [capper],
    now,
  );

  assert.equal(pick?.isEmbargoed, true);
  assert.equal(pick?.oddsAmerican, 0);
  assert.equal(pick?.parlay?.combinedOddsAmerican, null);
  assert.deepEqual(
    pick?.parlay?.legs.map((entry) => entry.selection),
    ["Pick hidden", "Pick hidden"],
  );
});

test("a parlay whose capper is not in the feed set is dropped", () => {
  assert.equal(joinParlaysToPublicPicks([parlayRow()], []).length, 0);
});

test("straight picks and parlays merge into one chronological ledger", () => {
  const merged = mergePublicPicks(
    joinPlaysToPublicPicks(
      [
        {
          id: "play-1",
          capperId: capper.id,
          sport: "MLB",
          league: "MLB",
          market: "Moneyline",
          selection: "Mets ML",
          oddsAmerican: -120,
          units: 1,
          outcome: "WIN",
          profitUnits: 0.83,
          createdAt: new Date("2026-08-22T17:00:00Z"),
          verificationTier: "VERIFIED",
          side: "Mets",
          eventStartsAt: new Date("2026-08-22T23:00:00Z"),
        },
      ],
      [capper],
    ),
    joinParlaysToPublicPicks([parlayRow()], [capper]),
  );

  assert.deepEqual(
    merged.map((pick) => pick.id),
    ["parlay-1", "play-1"],
  );
});

test("parlay scope filters read off the legs, and never overwrite each other", () => {
  const where = buildPublicParlayScopeWhere(
    { window: "7d", sport: "MLB", status: "live" },
    new Date("2026-08-23T20:00:00Z"),
  );
  const conditions = where.AND;

  assert.ok(Array.isArray(conditions));
  // window + sport + pending-outcome + started-leg — the sport predicate has to
  // survive alongside the lifecycle one, which is why they are ANDed.
  assert.equal(conditions.length, 4);
  assert.ok(
    conditions.some(
      (condition) =>
        JSON.stringify(condition) ===
        JSON.stringify({ legs: { some: { sport: "MLB" } } }),
    ),
  );
});

test("an unfiltered parlay scope adds no predicate at all", () => {
  assert.deepEqual(
    buildPublicParlayScopeWhere(
      { window: "all", sport: "all", status: "all" },
      new Date(),
    ),
    {},
  );
});

test("parlay display helpers name the position the same way everywhere", () => {
  const legs = parlayRow().legs;

  assert.equal(parlayTitle(legs.length), "2-Leg Parlay");
  assert.equal(parlayGameLabel(legs), "2 games");
  assert.equal(parlayGameLabel([legs[0]!]), "Red Sox @ Yankees");
  assert.equal(parlayDisplaySport(legs), "MLB");
  assert.equal(parlayDisplaySport([legs[0]!, leg({ sport: "NFL" })]), "MLB");
  assert.equal(parlayBookLabel(legs), "draftkings");
  assert.equal(
    parlayBookLabel([legs[0]!, leg({ book: "fanduel" })]),
    "Mixed Books",
  );
  assert.equal(parlayBookLabel([leg({ book: null })]), null);
  assert.equal(parlayVerificationTier([]), "SELF_REPORTED");
  assert.equal(earliestLegStart([{ eventStartsAt: null }]), null);
});

test("every public position surface reads parlays, not straight plays alone", () => {
  for (const [file, marker] of [
    // Public picks ledger feed.
    ["src/lib/queries/plays.ts", /prisma\.parlay\.findMany/],
    // Home "today's moves" board and the featured proof receipt.
    ["src/lib/queries/home-live.ts", /prisma\.parlay\.findMany/],
    // Homepage marquee.
    ["src/lib/queries/live-activity-ticker.ts", /prisma\.parlay\.findMany/],
    // Graded-results ticker.
    ["src/lib/queries/yesterday-wins.ts", /prisma\.parlay\.findMany/],
    // Profile Pick History.
    ["src/lib/queries/capper.ts", /prisma\.parlay\.findMany/],
  ] as const) {
    assert.match(source(file), marker, `${file} must read parlays`);
  }
});

test("CLV surfaces stay straight-play only — a parlay has no closing price", () => {
  const platformClv = source("src/lib/queries/platform-clv.ts");

  assert.match(platformClv, /parlayId: null/);
  assert.doesNotMatch(platformClv, /prisma\.parlay\./);
});
