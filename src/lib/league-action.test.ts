import assert from "node:assert/strict";
import test from "node:test";

import {
  PLATFORM_REPORT_ELIGIBILITY_FOOTNOTE,
  classifyMarketCategory,
  countLabel,
  leagueInitials,
  marketCategories,
  platformReportLeagueLabel,
  platformReportSegmentLabel,
  platformReportSubtitle,
  platformTrackedPicks,
  rankLeagueAction,
  rankLeagueActionCategories,
  shapeCategories,
} from "@/lib/league-action";
import { MIN_GRADED_FOR_SIGNAL } from "@/lib/sample";

test("platform report copy uses publicly listed + singular-aware counts", () => {
  assert.equal(
    platformReportSubtitle(30),
    "Odds-Verified Bet Types From Publicly Listed Cappers — Last 30 Days.",
  );
  assert.equal(
    PLATFORM_REPORT_ELIGIBILITY_FOOTNOTE,
    "Odds-Verified Picks From Publicly Listed Cappers, Including Ranked Cappers And Cappers Building A Record. Test Accounts Are Excluded.",
  );
  assert.equal(countLabel(1, "graded pick", "graded picks"), "1 graded pick");
  assert.equal(countLabel(2, "graded pick", "graded picks"), "2 graded picks");
  assert.equal(countLabel(1, "capper", "cappers"), "1 capper");
  assert.equal(platformReportSegmentLabel(1), "Active Bet Type");
  assert.equal(platformReportSegmentLabel(3), "Active Bet Types");
  assert.equal(platformReportLeagueLabel(1), "Tracked League");
  assert.equal(platformReportLeagueLabel(2), "Tracked Leagues");
});

test("rankLeagueAction groups by league fallback and ranks by pick volume", () => {
  const leagues = rankLeagueAction([
    { sport: "MLB", league: "MLB", capperId: "c1" },
    { sport: "MLB", league: "MLB", capperId: "c2" },
    { sport: "WNBA", league: null, capperId: "c1" },
    { sport: "WNBA", league: "WNBA", capperId: "c1" },
    { sport: "NBA", league: "NBA", capperId: "c3" },
  ]);

  assert.deepEqual(leagues, [
    {
      key: "MLB:MLB",
      sport: "MLB",
      league: "MLB",
      pickCount: 2,
      activeCappers: 2,
    },
    {
      key: "WNBA:WNBA",
      sport: "WNBA",
      league: "WNBA",
      pickCount: 2,
      activeCappers: 1,
    },
    {
      key: "NBA:NBA",
      sport: "NBA",
      league: "NBA",
      pickCount: 1,
      activeCappers: 1,
    },
  ]);
});

test("classifyMarketCategory maps sides / totals / props / futures", () => {
  assert.equal(classifyMarketCategory("Moneyline"), "sides");
  assert.equal(classifyMarketCategory("Spread"), "sides");
  assert.equal(classifyMarketCategory("Run Line"), "sides");
  assert.equal(classifyMarketCategory("Total"), "totals");
  assert.equal(classifyMarketCategory("Player Props"), "props");
  assert.equal(classifyMarketCategory("Futures"), "futures");
  assert.equal(classifyMarketCategory("Season Outright"), "futures");
  assert.equal(classifyMarketCategory("Custom Exotic"), null);
});

test("rankLeagueActionCategories: shape vs market without double-counting parlays", () => {
  const now = new Date("2026-07-10T12:00:00.000Z");
  const start = new Date("2026-07-10T18:00:00.000Z");

  const categories = rankLeagueActionCategories(
    [
      {
        sport: "NBA",
        league: "NBA",
        capperId: "c1",
        market: "Moneyline",
        parlayId: null,
        outcome: "WIN",
        units: 1,
        profitUnits: 0.91,
        createdAt: now,
        eventStartsAt: start,
      },
      {
        sport: "NBA",
        league: "NBA",
        capperId: "c1",
        market: "Spread",
        parlayId: null,
        outcome: "LOSS",
        units: 1,
        profitUnits: -1,
        createdAt: now,
        eventStartsAt: start,
      },
      {
        sport: "NBA",
        league: "NBA",
        capperId: "c2",
        market: "Total",
        parlayId: null,
        outcome: "PENDING",
        units: 1,
        profitUnits: null,
        createdAt: now,
        eventStartsAt: start,
      },
      {
        sport: "NBA",
        league: "NBA",
        capperId: "c2",
        market: "Player Props",
        parlayId: null,
        outcome: "PUSH",
        units: 1,
        profitUnits: 0,
        createdAt: now,
        eventStartsAt: start,
      },
      {
        sport: "MLB",
        league: "MLB",
        capperId: "c3",
        market: "Futures",
        parlayId: null,
        outcome: "PENDING",
        units: 1,
        profitUnits: null,
        createdAt: now,
        eventStartsAt: null,
      },
      // Parlay leg — must NOT inflate singles/sides
      {
        sport: "MLB",
        league: "MLB",
        capperId: "c4",
        market: "Moneyline",
        parlayId: "parlay-1",
        outcome: "WIN",
        units: 1,
        profitUnits: 0.9,
        createdAt: now,
        eventStartsAt: start,
      },
    ],
    [
      {
        capperId: "c4",
        outcome: "WIN",
        units: 1,
        profitUnits: 2.5,
        createdAt: now,
        eventStartsAt: start,
      },
      {
        capperId: "c4",
        outcome: "PENDING",
        units: 1,
        profitUnits: null,
        createdAt: now,
        eventStartsAt: start,
      },
    ],
  );

  const byKey = Object.fromEntries(categories.map((c) => [c.key, c]));

  assert.equal(byKey.singles?.picks, 5);
  assert.equal(byKey.parlays?.picks, 2);
  assert.equal(byKey.parlays?.cappers, 1);
  assert.equal(byKey.sides?.picks, 2);
  assert.equal(byKey.totals?.picks, 1);
  assert.equal(byKey.props?.picks, 1);
  assert.equal(byKey.futures?.picks, 1);

  // Tracked volume = shape only (no market double-count, no flattened legs)
  assert.equal(platformTrackedPicks(categories), 7);
  assert.equal(shapeCategories(categories).length, 2);
  assert.equal(marketCategories(categories).length, 4);

  // Below signal → null ROI/units
  assert.ok((byKey.singles?.graded ?? 0) < MIN_GRADED_FOR_SIGNAL);
  assert.equal(byKey.singles?.roi, null);
  assert.equal(byKey.singles?.units, null);

  // Pre-game timing when createdAt < eventStartsAt
  assert.equal(byKey.sides?.preGame, 2);
  assert.equal(byKey.sides?.live, 0);
});

test("rankLeagueActionCategories surfaces ROI/units only at signal sample", () => {
  const rows = Array.from({ length: MIN_GRADED_FOR_SIGNAL }, (_, i) => ({
    sport: "NBA",
    league: "NBA",
    capperId: `c${i % 3}`,
    market: "Moneyline",
    parlayId: null,
    outcome: i % 2 === 0 ? "WIN" : "LOSS",
    units: 1,
    profitUnits: i % 2 === 0 ? 0.91 : -1,
    createdAt: new Date("2026-07-01T12:00:00.000Z"),
    eventStartsAt: new Date("2026-07-01T18:00:00.000Z"),
  }));

  const categories = rankLeagueActionCategories(rows, []);
  const sides = categories.find((c) => c.key === "sides");
  assert.ok(sides);
  assert.equal(sides.graded, MIN_GRADED_FOR_SIGNAL);
  assert.ok(sides.roi != null);
  assert.ok(sides.units != null);
});

test("leagueInitials creates compact temporary marks", () => {
  assert.equal(leagueInitials("Major League Baseball"), "MLB");
  assert.equal(leagueInitials("WNBA"), "WNBA");
  assert.equal(leagueInitials(""), "SCL");
});
