import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPerformanceTrend,
  hasLeaderboardSample,
  isBuildingARecord,
  profileStandingKind,
  isInLeaderboardWindow,
  isLeaderboardEligible,
  leaderboardHref,
  leaderboardParlayDateFilter,
  leaderboardPlayDateFilter,
  leaderboardSlateInstant,
  leaderboardWindowBounds,
  leaderboardWindowStart,
  parseLeaderboardFilters,
  parlayLeaderboardSlateInstant,
  partitionLeaderboard,
  sortLeaderboard,
  summarizeLeaderboard,
} from "@/lib/leaderboard";
import type { CapperSummary } from "@/lib/mock";

test("leaderboard filters reject unsupported query values", () => {
  assert.deepEqual(
    parseLeaderboardFilters({
      sport: "made-up",
      window: "forever",
      sort: "followers",
      minPicks: "13",
      record: "all",
      q: "  edge  ",
      limit: "99",
    }),
    {
      sport: "ALL",
      window: "all",
      sort: "units",
      direction: "desc",
      minPicks: 0,
      verifiedOnly: false,
      search: "edge",
      limit: 10,
    },
  );
});

test("legacy year scope normalizes to the supported all-time control", () => {
  const filters = parseLeaderboardFilters({ window: "year" });
  assert.equal(filters.window, "all");
});

test("leaderboard href can preserve filters on a shared route", () => {
  const filters = parseLeaderboardFilters({ sport: "NFL", sort: "roi" });
  assert.equal(
    leaderboardHref(filters, { sport: "ALL" }, "/discover"),
    "/discover?sort=roi",
  );
});

test("leaderboard filters accept clv sort and limit", () => {
  assert.equal(parseLeaderboardFilters({ sort: "clv" }).sort, "clv");
  assert.equal(parseLeaderboardFilters({ limit: "20" }).limit, 20);
  assert.equal(parseLeaderboardFilters({ sort: "sample" }).sort, "sample");
  assert.equal(parseLeaderboardFilters({ sort: "verified" }).sort, "units");
  assert.equal(parseLeaderboardFilters({ sort: "form" }).sort, "form");
  assert.equal(parseLeaderboardFilters({ dir: "asc" }).direction, "asc");
});

test("sortLeaderboard supports ascending metric order", () => {
  const sorted = sortLeaderboard(
    [
      { id: "a", name: "A", units: 7, settledPicks: 12 } as CapperSummary,
      { id: "b", name: "B", units: -2, settledPicks: 12 } as CapperSummary,
    ],
    "units",
    "asc",
  );
  assert.deepEqual(
    sorted.map((capper) => capper.id),
    ["b", "a"],
  );
});

test("sortLeaderboard ranks by avgClv when sort=clv", () => {
  const sorted = sortLeaderboard(
    [
      { id: "a", name: "A", avgClv: 0.01, settledPicks: 12 } as CapperSummary,
      { id: "b", name: "B", avgClv: 0.05, settledPicks: 12 } as CapperSummary,
      { id: "c", name: "C", avgClv: null, settledPicks: 12 } as CapperSummary,
    ],
    "clv",
  );
  assert.deepEqual(
    sorted.map((c) => c.id),
    ["b", "a", "c"],
  );
});

test("sortLeaderboard ranks by sample and form", () => {
  const sortedSample = sortLeaderboard(
    [
      { id: "a", name: "A", settledPicks: 12 } as CapperSummary,
      { id: "b", name: "B", settledPicks: 40 } as CapperSummary,
    ],
    "sample",
  );
  assert.deepEqual(
    sortedSample.map((c) => c.id),
    ["b", "a"],
  );

  const sortedForm = sortLeaderboard(
    [
      { id: "a", name: "A", streak: 1, settledPicks: 12 } as CapperSummary,
      { id: "b", name: "B", streak: 4, settledPicks: 12 } as CapperSummary,
    ],
    "form",
  );
  assert.deepEqual(
    sortedForm.map((c) => c.id),
    ["b", "a"],
  );
});

test("CLV sort requires signal sample and avgClv", () => {
  const filters = parseLeaderboardFilters({ sort: "clv", minPicks: "0" });
  assert.equal(
    isLeaderboardEligible(
      {
        settledPicks: 12,
        units: 1,
        roi: 1,
        avgClv: 0.02,
      } as CapperSummary,
      filters,
    ),
    true,
  );
  assert.equal(
    isLeaderboardEligible(
      {
        settledPicks: 12,
        units: 1,
        roi: 1,
        avgClv: null,
      } as CapperSummary,
      filters,
    ),
    false,
  );
  assert.equal(
    isLeaderboardEligible(
      {
        settledPicks: 5,
        units: 1,
        roi: 1,
        avgClv: 0.02,
      } as CapperSummary,
      filters,
    ),
    false,
  );
});

test("year window begins at the UTC calendar-year boundary", () => {
  assert.equal(
    leaderboardWindowStart(
      "year",
      new Date("2026-06-29T12:00:00Z"),
    )?.toISOString(),
    "2026-01-01T00:00:00.000Z",
  );
});

test("1D is yesterday's completed Eastern slate day", () => {
  const summer = leaderboardWindowBounds(
    "1d",
    new Date("2026-08-17T16:00:00Z"),
  );
  assert.equal(summer.start?.toISOString(), "2026-08-16T04:00:00.000Z");
  assert.equal(summer.end?.toISOString(), "2026-08-17T04:00:00.000Z");

  const winter = leaderboardWindowBounds(
    "1d",
    new Date("2026-01-17T16:00:00Z"),
  );
  assert.equal(winter.start?.toISOString(), "2026-01-16T05:00:00.000Z");
  assert.equal(winter.end?.toISOString(), "2026-01-17T05:00:00.000Z");

  // The completed day remains a calendar day across the spring DST change,
  // even though that particular Eastern day contains only 23 hours.
  const springForward = leaderboardWindowBounds(
    "1d",
    new Date("2026-03-09T04:30:00Z"),
  );
  assert.equal(springForward.start?.toISOString(), "2026-03-08T05:00:00.000Z");
  assert.equal(springForward.end?.toISOString(), "2026-03-09T04:00:00.000Z");
});

test("longer leaderboard scopes remain rolling windows without an upper bound", () => {
  const now = new Date("2026-08-17T16:00:00Z");
  const range = leaderboardWindowBounds("7d", now);
  assert.equal(range.start?.toISOString(), "2026-08-10T16:00:00.000Z");
  assert.equal(range.end, null);
});

test("1D scopes straight picks to yesterday's slate, not settlement time", () => {
  const now = new Date("2026-08-19T16:00:00Z"); // Wednesday afternoon UTC
  const filter = leaderboardPlayDateFilter("1d", now);
  assert.deepEqual(filter, {
    outcome: { in: ["WIN", "LOSS", "PUSH"] },
    OR: [
      {
        eventStartsAt: {
          gte: new Date("2026-08-18T04:00:00.000Z"),
          lt: new Date("2026-08-19T04:00:00.000Z"),
        },
      },
      {
        eventStartsAt: null,
        createdAt: {
          gte: new Date("2026-08-18T04:00:00.000Z"),
          lt: new Date("2026-08-19T04:00:00.000Z"),
        },
      },
    ],
  });

  // Tuesday 10pm ET game that grades Wednesday 1:30am ET still belongs to 1D.
  const lateWestCoast = {
    eventStartsAt: new Date("2026-08-19T02:00:00.000Z"),
    createdAt: new Date("2026-08-18T18:00:00.000Z"),
    gradedAt: new Date("2026-08-19T05:30:00.000Z"),
  };
  assert.equal(
    isInLeaderboardWindow(leaderboardSlateInstant(lateWestCoast), "1d", now),
    true,
  );

  // Settlement-time filtering would have dropped that game (graded after 4:00Z).
  assert.equal(
    lateWestCoast.gradedAt < new Date("2026-08-19T04:00:00.000Z"),
    false,
  );

  // A Monday night game that happens to be graded Tuesday is not yesterday.
  const delayedGrade = {
    eventStartsAt: new Date("2026-08-18T02:00:00.000Z"),
    createdAt: new Date("2026-08-17T18:00:00.000Z"),
  };
  assert.equal(
    isInLeaderboardWindow(leaderboardSlateInstant(delayedGrade), "1d", now),
    false,
  );

  // Unbound legacy picks still use log time on yesterday's Eastern day.
  const unbound = {
    eventStartsAt: null,
    createdAt: new Date("2026-08-18T20:00:00.000Z"),
  };
  assert.equal(
    isInLeaderboardWindow(leaderboardSlateInstant(unbound), "1d", now),
    true,
  );
});

test("1D scopes parlays to the last bound leg's slate day", () => {
  const now = new Date("2026-08-19T16:00:00Z");
  const filter = leaderboardParlayDateFilter("1d", now);
  assert.deepEqual(filter, {
    outcome: { in: ["WIN", "LOSS", "PUSH"] },
    OR: [
      {
        AND: [
          {
            legs: {
              some: {
                eventStartsAt: {
                  gte: new Date("2026-08-18T04:00:00.000Z"),
                  lt: new Date("2026-08-19T04:00:00.000Z"),
                },
              },
            },
          },
          {
            legs: {
              none: {
                eventStartsAt: { gte: new Date("2026-08-19T04:00:00.000Z") },
              },
            },
          },
        ],
      },
      {
        AND: [
          { legs: { none: { eventStartsAt: { not: null } } } },
          {
            createdAt: {
              gte: new Date("2026-08-18T04:00:00.000Z"),
              lt: new Date("2026-08-19T04:00:00.000Z"),
            },
          },
        ],
      },
    ],
  });

  const yesterdayThenToday = {
    createdAt: new Date("2026-08-18T16:00:00.000Z"),
    legs: [
      { eventStartsAt: new Date("2026-08-18T23:00:00.000Z") },
      { eventStartsAt: new Date("2026-08-19T17:00:00.000Z") },
    ],
  };
  assert.equal(
    isInLeaderboardWindow(
      parlayLeaderboardSlateInstant(yesterdayThenToday),
      "1d",
      now,
    ),
    false,
  );

  const sameSlateParlay = {
    createdAt: new Date("2026-08-18T16:00:00.000Z"),
    legs: [
      { eventStartsAt: new Date("2026-08-18T17:00:00.000Z") },
      { eventStartsAt: new Date("2026-08-19T02:00:00.000Z") },
    ],
  };
  assert.equal(
    isInLeaderboardWindow(
      parlayLeaderboardSlateInstant(sameSlateParlay),
      "1d",
      now,
    ),
    true,
  );
});

test("longer and all-time leaderboard position filters keep their existing semantics", () => {
  const now = new Date("2026-08-17T16:00:00Z");
  assert.deepEqual(leaderboardPlayDateFilter("7d", now), {
    createdAt: { gte: new Date("2026-08-10T16:00:00.000Z") },
  });
  assert.deepEqual(leaderboardParlayDateFilter("7d", now), {
    createdAt: { gte: new Date("2026-08-10T16:00:00.000Z") },
  });
  assert.equal(leaderboardPlayDateFilter("all", now), undefined);
  assert.equal(leaderboardParlayDateFilter("all", now), undefined);
});

test("performance trend is cumulative and excludes unsettled plays", () => {
  assert.deepEqual(
    buildPerformanceTrend([
      { outcome: "WIN", profitUnits: 1.2 },
      { outcome: "PENDING", profitUnits: null },
      { outcome: "LOSS", profitUnits: -1 },
      { outcome: "PUSH", profitUnits: 0 },
    ]),
    [0, 1.2, 0.2, 0.2],
  );
});

test("zero-sample cappers are never ranking-eligible", () => {
  const unscoped = parseLeaderboardFilters({ minPicks: "0" });
  const scoped = parseLeaderboardFilters({ sport: "MLB", minPicks: "0" });
  const zero = { settledPicks: 0 } as CapperSummary;

  assert.equal(isLeaderboardEligible(zero, unscoped), false);
  assert.equal(isLeaderboardEligible(zero, scoped), false);
  assert.equal(hasLeaderboardSample(zero, unscoped), false);
});

test("below-minimum-sample cappers are not ranking-eligible", () => {
  const filters = parseLeaderboardFilters({ minPicks: "10" });
  assert.equal(
    isLeaderboardEligible({ settledPicks: 9 } as CapperSummary, filters),
    false,
  );
  assert.equal(
    isLeaderboardEligible(
      { settledPicks: 10, units: 0, roi: 0 } as CapperSummary,
      filters,
    ),
    true,
  );
});

test("net-negative cappers remain ranking-eligible once the sample is met", () => {
  const filters = parseLeaderboardFilters({ minPicks: "10" });
  assert.equal(
    isLeaderboardEligible(
      { settledPicks: 20, units: -0.01, roi: -0.1 } as CapperSummary,
      filters,
    ),
    true,
  );
  assert.equal(
    isLeaderboardEligible(
      { settledPicks: 20, units: 0, roi: 0 } as CapperSummary,
      filters,
    ),
    true,
  );
});

test("isBuildingARecord agrees with the leaderboard partition gate", () => {
  // Prefer partitioned rank when present (feed cards use this).
  assert.equal(isBuildingARecord({ rank: 0, settledPicks: 0 }), true);
  assert.equal(isBuildingARecord({ rank: 1, settledPicks: 0 }), false);
  // Default minPicks=0 matches getLeaderboardResult(): zero graded = building.
  assert.equal(isBuildingARecord({ settledPicks: 0 }), true);
  assert.equal(isBuildingARecord({ settledPicks: 1 }), false);
  // Unknown sample is not treated as building (mock cards without partition data).
  assert.equal(isBuildingARecord({}), false);
  // Higher threshold matches leaderboard min-sample filter.
  assert.equal(isBuildingARecord({ settledPicks: 9 }, 10), true);
  assert.equal(isBuildingARecord({ settledPicks: 10 }, 10), false);
  // Performance affects position, not whether a sufficiently mature record exists.
  assert.equal(
    isBuildingARecord({ settledPicks: 10, units: -0.25, roi: -2 }, 10),
    false,
  );
});

test("profileStandingKind does not treat an unpartitioned rank 0 as building", () => {
  assert.equal(
    profileStandingKind({ rank: 0, settledPicks: 1118 }),
    "established",
  );
  assert.equal(profileStandingKind({ rank: 4, settledPicks: 1118 }), "ranked");
  assert.equal(profileStandingKind({ rank: 0, settledPicks: 0 }), "building");
});

test("partitionLeaderboard ranks every sample-eligible capper and clears unranked places", () => {
  const filters = parseLeaderboardFilters({ minPicks: "10", sort: "units" });
  const cappers = [
    {
      id: "a",
      name: "Alpha",
      settledPicks: 12,
      units: 4,
      roi: 10,
      winPct: 55,
      rank: 99,
    },
    {
      id: "b",
      name: "Bravo",
      settledPicks: 0,
      units: 0,
      roi: 0,
      winPct: 0,
      rank: 99,
    },
    {
      id: "c",
      name: "Charlie",
      settledPicks: 5,
      units: 20,
      roi: 40,
      winPct: 80,
      rank: 99,
    },
    {
      id: "d",
      name: "Delta",
      settledPicks: 15,
      units: 8,
      roi: 12,
      winPct: 60,
      rank: 99,
    },
    {
      id: "e",
      name: "Echo",
      settledPicks: 18,
      units: -2,
      roi: -4,
      winPct: 45,
      rank: 99,
    },
  ] as CapperSummary[];

  const { ranked, unranked } = partitionLeaderboard(cappers, filters);
  assert.equal(ranked.length + unranked.length, cappers.length);

  assert.deepEqual(
    ranked.map((c) => ({ id: c.id, rank: c.rank })),
    [
      { id: "d", rank: 1 },
      { id: "a", rank: 2 },
      { id: "e", rank: 3 },
    ],
  );
  assert.deepEqual(
    unranked.map((c) => ({ id: c.id, rank: c.rank })),
    [
      { id: "c", rank: 0 },
      { id: "b", rank: 0 },
    ],
  );
});

test("leaderboard summary keeps ranked count separate from scoped totals", () => {
  const ranked = [
    {
      verified: true,
      record: { w: 6, l: 4, p: 0 },
      settledPicks: 10,
      units: 2,
      stakedUnits: 10,
    },
  ] as CapperSummary[];
  const unranked = [
    {
      verified: false,
      record: { w: 1, l: 4, p: 0 },
      settledPicks: 5,
      units: -1,
      stakedUnits: 5,
    },
  ] as CapperSummary[];

  assert.deepEqual(summarizeLeaderboard(ranked, unranked), {
    rankedCappers: 1,
    verifiedCappers: 1,
    trackedPicks: 15,
    winPct: (7 / 15) * 100,
    netUnits: 1,
    roi: (1 / 15) * 100,
    profitableCappers: 1,
  });
});

test("the board defaults to every public record, not verified-only", () => {
  // Cappers carried over from the previous platform are unclaimed by design
  // (no password until they claim the handle), so an email-verified default
  // would hide the entire imported roster behind an empty board.
  assert.equal(parseLeaderboardFilters({}).verifiedOnly, false);
  assert.equal(parseLeaderboardFilters({ record: "all" }).verifiedOnly, false);
  assert.equal(
    parseLeaderboardFilters({ record: "nonsense" }).verifiedOnly,
    false,
  );
});

test("'Verified only' is still selectable and still means email-verified", () => {
  assert.equal(
    parseLeaderboardFilters({ record: "verified" }).verifiedOnly,
    true,
  );
});

test("the record filter round-trips through the URL", () => {
  const base = parseLeaderboardFilters({});
  // Default carries no param...
  assert.equal(leaderboardHref(base), "/leaderboard");
  // ...and the narrower choice survives a round trip.
  const href = leaderboardHref(base, { verifiedOnly: true });
  assert.equal(href, "/leaderboard?record=verified");
  const parsed = parseLeaderboardFilters(
    Object.fromEntries(new URL(href, "https://x").searchParams),
  );
  assert.equal(parsed.verifiedOnly, true);
});
