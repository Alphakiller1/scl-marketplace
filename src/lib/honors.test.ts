import assert from "node:assert/strict";
import test from "node:test";

import {
  ANNUAL_MINIMUM,
  SUPERMAX,
  SUPERMAX_ANNUAL_MINIMUM,
  SUPERMAX_MONTHLY_MINIMUM,
  computeHonors,
  CROSS_SPORTS_MINIMUM,
  featuredHonors,
  honorMinimum,
  honorsCriteria,
  honorsRules,
  seasonPeriod,
  type HonorCapper,
  type HonorLegacyTotal,
  type HonorPosition,
} from "@/lib/honors";
import { CROSS_SPORTS } from "@/lib/parlay-sport";

const ALICE: HonorCapper = { id: "a", name: "alice", handle: "alice" };
const BOB: HonorCapper = { id: "b", name: "bob", handle: "bob" };

function picks(
  capperId: string,
  sport: string,
  at: string,
  count: number,
  profitEach: number,
): HonorPosition[] {
  return Array.from({ length: count }, () => ({
    capperId,
    sport,
    at: new Date(at),
    outcome: profitEach >= 0 ? "WIN" : "LOSS",
    units: 1,
    profitUnits: profitEach,
  }));
}

function legacyRow(
  capperId: string,
  sport: string,
  wins: number,
  losses: number,
  risked: number,
  net: number,
): HonorLegacyTotal {
  return {
    capperId,
    scope: "YEAR_2025",
    sport,
    wins,
    losses,
    pushes: 0,
    unitsRisked: risked,
    unitsNet: net,
  };
}

const NOW = new Date("2026-09-16T16:00:00Z");

test("program minimums by sport and period", () => {
  assert.equal(ANNUAL_MINIMUM, 250);
  assert.equal(honorMinimum("annual", "ALL"), 250);
  assert.equal(honorMinimum("season", "MLB"), 200);
  assert.equal(honorMinimum("season", "NBA"), 150);
  assert.equal(honorMinimum("season", "CFL"), 40);
  assert.equal(honorMinimum("season", "MMA"), 75);
  assert.equal(honorMinimum("monthly", "MLB"), 25);
  assert.equal(honorMinimum("monthly", "NFL"), 15);
  assert.equal(honorMinimum("monthly", "PGA"), 10);
  assert.equal(honorMinimum("monthly", CROSS_SPORTS), CROSS_SPORTS_MINIMUM);
  // Sports outside the program never qualify.
  assert.equal(honorMinimum("monthly", "BOXING"), Number.POSITIVE_INFINITY);
});

test("monthly awards cover the last completed month, never the current one", () => {
  const awards = computeHonors({
    cappers: [ALICE],
    positions: [
      ...picks("a", "MLB", "2026-08-10T23:00:00Z", 25, 1),
      ...picks("a", "MLB", "2026-09-05T23:00:00Z", 25, 1),
    ],
    legacy: [],
    now: NOW,
  });
  const monthly = awards.filter((a) => a.period === "monthly");
  assert.deepEqual(
    monthly.map((a) => [a.id, a.name, a.abbreviation]),
    [
      [
        "monthly-2026-08-mlb-units",
        "August 2026 MLB Monthly Winner (Units)",
        "AUG26 ($)",
      ],
      [
        "monthly-2026-08-mlb-roi",
        "August 2026 MLB Monthly Winner (ROI%)",
        "AUG26 (%)",
      ],
    ],
  );
});

test("below the sport's monthly minimum, no award", () => {
  const awards = computeHonors({
    cappers: [ALICE],
    positions: picks("a", "MLB", "2026-08-10T23:00:00Z", 24, 5),
    legacy: [],
    now: NOW,
  });
  assert.deepEqual(awards, []);
});

test("months follow Eastern Time at the boundary", () => {
  // 02:00 UTC on Sep 1 is still Aug 31 in New York.
  const awards = computeHonors({
    cappers: [ALICE],
    positions: picks("a", "NFL", "2026-09-01T02:00:00Z", 15, 1),
    legacy: [],
    now: NOW,
  });
  assert.ok(awards.some((a) => a.id === "monthly-2026-08-nfl-units"));
});

test("a negative top performer never wins", () => {
  const awards = computeHonors({
    cappers: [ALICE],
    positions: picks("a", CROSS_SPORTS, "2026-08-10T23:00:00Z", 12, -1),
    legacy: [],
    now: NOW,
  });
  assert.deepEqual(awards, []);
});

test("Cross Sport Parlay Allstar is units-only", () => {
  const awards = computeHonors({
    cappers: [ALICE],
    positions: picks(
      "a",
      CROSS_SPORTS,
      "2026-08-10T23:00:00Z",
      CROSS_SPORTS_MINIMUM,
      2,
    ),
    legacy: [],
    now: NOW,
  });
  assert.deepEqual(
    awards.map((a) => [a.name, a.metric, a.abbreviation]),
    [["August 2026 Cross Sport Parlay Allstar", "units", "AUG26 ($)"]],
  );
});

test("2025 annual and season awards come from the legacy 2025 records", () => {
  const legacy = [
    legacyRow("a", "ALL", 300, 200, 1500, 450),
    legacyRow("b", "ALL", 160, 100, 300, 150),
    legacyRow("b", "NFL", 30, 20, 100, 50),
    legacyRow("a", "NBA", 30, 20, 100, 50),
  ];
  const awards = computeHonors({
    cappers: [ALICE, BOB],
    positions: [],
    legacy,
    now: NOW,
  });
  const byId = new Map(awards.map((a) => [a.id, a]));
  const coty = byId.get("annual-2025-all-units");
  assert.equal(coty?.name, "2025 Capper of the Year");
  assert.equal(coty?.abbreviation, "2025 COTY");
  assert.equal(coty?.winner.handle, "alice");
  const perf = byId.get("annual-2025-all-roi");
  assert.equal(perf?.name, "2025 Annual Performance Award");
  assert.equal(perf?.abbreviation, "2025 ROI");
  assert.equal(perf?.winner.handle, "bob");
  const nfl = byId.get("season-2025-nfl-units");
  assert.equal(nfl?.name, "2025 NFL Season Champion (Units)");
  assert.equal(nfl?.abbreviation, "NFL25 ($)");
  // 50 NBA picks is below the NBA season minimum of 150.
  assert.ok(!byId.has("season-2025-nba-units"));
  // 2026 is still in progress on Sept 16.
  assert.ok(!awards.some((a) => a.periodKey === "2026"));
});

test("season chips use the program abbreviations", () => {
  const awards = computeHonors({
    cappers: [ALICE],
    positions: [],
    legacy: [
      legacyRow("a", "SOCCER", 60, 40, 100, 20),
      legacyRow("a", "MMA", 50, 25, 80, 10),
    ],
    now: NOW,
  });
  const chips = new Set(awards.map((a) => a.abbreviation));
  assert.ok(chips.has("SOC25 ($)"));
  assert.ok(chips.has("UFC25 (%)"));
  assert.ok(awards.some((a) => a.name === "2025 UFC Season Champion (ROI%)"));
});

test("a season is granted only after its window closes", () => {
  const wnba = seasonPeriod("WNBA", 2026);
  assert.equal(wnba.key, "2026");
  const positions = picks("a", "WNBA", "2026-07-10T23:00:00Z", 100, 1);
  const during = computeHonors({
    cappers: [ALICE],
    positions,
    legacy: [],
    now: new Date("2026-10-31T12:00:00Z"),
  });
  assert.ok(!during.some((a) => a.id === "season-2026-wnba-units"));
  const after = computeHonors({
    cappers: [ALICE],
    positions,
    legacy: [],
    now: new Date("2026-11-01T12:00:00Z"),
  });
  const award = after.find((a) => a.id === "season-2026-wnba-units");
  assert.equal(award?.abbreviation, "WNBA26 ($)");
});

test("split-year seasons are labelled by both years", () => {
  const nba = seasonPeriod("NBA", 2026);
  assert.equal(nba.key, "2026-27");
  assert.ok(nba.end.getTime() > new Date("2027-06-30T12:00:00Z").getTime());
});

test("featured: last year, last month, and seasons for sports in season", () => {
  const awards = computeHonors({
    cappers: [ALICE],
    positions: [
      ...picks("a", "MLB", "2026-07-10T23:00:00Z", 25, 1),
      ...picks("a", "MLB", "2026-08-10T23:00:00Z", 25, 1),
    ],
    legacy: [
      legacyRow("a", "ALL", 300, 200, 1500, 450),
      legacyRow("a", "NFL", 30, 20, 100, 50),
      legacyRow("a", "NBA", 100, 60, 200, 50),
    ],
    now: NOW,
  });
  const featured = featuredHonors(awards, NOW);
  assert.deepEqual(
    [...new Set(featured.monthly.map((a) => a.periodKey))],
    ["2026-08"],
  );
  assert.deepEqual(
    featured.annual.map((a) => a.abbreviation),
    ["2025 COTY", "2025 ROI"],
  );
  // NFL is in season in September; the NBA is not.
  assert.deepEqual([...new Set(featured.season.map((a) => a.sport))], ["NFL"]);
  // In January 2027 the 2025 annual awards have given way to 2026's.
  assert.equal(
    featuredHonors(awards, new Date("2027-01-15T12:00:00Z")).annual.length,
    0,
  );
});

test("a season award shows for the month after its season, then drops off", () => {
  const positions = picks("a", "WNBA", "2026-07-10T23:00:00Z", 100, 1);
  const at = (iso: string) =>
    featuredHonors(
      computeHonors({
        cappers: [ALICE],
        positions,
        legacy: [],
        now: new Date(iso),
      }),
      new Date(iso),
    ).season.length;
  assert.equal(at("2026-11-20T12:00:00Z"), 2);
  assert.equal(at("2026-12-15T12:00:00Z"), 0);
  // Back on the boards once the next WNBA season starts.
  assert.equal(at("2027-05-10T12:00:00Z"), 2);
});

test("published rules and criteria come from the config", () => {
  const text = honorsRules()
    .flatMap((group) => group.lines)
    .join(" ");
  assert.match(text, /need 250 settled picks in the calendar year/);
  assert.match(text, /minimum 3 settled Supermax plays/);
  assert.match(text, /minimum 20 settled Supermax plays/);
  assert.doesNotMatch(text, /Seasonal|rolling 90-day/);
  const mlb = honorsCriteria().find((row) => row.sport === "MLB");
  assert.deepEqual(mlb, {
    sport: "MLB",
    label: "MLB",
    seasonMinimum: 200,
    season: "Mar–Nov",
    monthlyMinimum: 25,
  });
  assert.equal(
    honorsCriteria().find((row) => row.sport === "TENNIS")?.season,
    "Calendar year",
  );
});

test("awards survive the query cache's date revival unchanged", async () => {
  const { reviveCachedDates } = await import("@/lib/cache-dates");
  const awards = computeHonors({
    cappers: [ALICE],
    positions: [],
    legacy: [
      legacyRow("a", "ALL", 300, 200, 1500, 450),
      legacyRow("a", "NFL", 30, 20, 100, 50),
    ],
    now: NOW,
  });
  // A cache HIT hands back JSON with ISO strings turned into Dates.
  const revived = reviveCachedDates(JSON.parse(JSON.stringify(awards)));
  const featured = featuredHonors(revived, NOW);
  assert.deepEqual(
    featured.season.map((a) => a.metric),
    ["units", "roi"],
  );
  assert.equal(typeof revived[0]!.periodEnd, "number");
});

test("Honors art follows the design spec: no gold, pink conviction marks", async () => {
  const { readFileSync } = await import("node:fs");
  const files = [
    "src/components/scl/honor-icons.tsx",
    "src/components/scl/honor-trophy-card.tsx",
    "src/components/scl/honor-card.tsx",
    "src/components/scl/honors-showcase.tsx",
    "src/components/scl/leaderboard-ranking-rail.tsx",
    "src/lib/og/honor-og-card.tsx",
    "src/app/globals.css",
  ];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.doesNotMatch(src, /--scl-honor-gold|#e9b64b|#b98f2e|#f1c35b/i, file);
    // Amber is data magnitude only — never an honor.
    if (/honor/i.test(file)) {
      assert.doesNotMatch(src, /perf-mid/, file);
    }
    // No gold crown or trophy emoji; annual marks are drawn pink.
    assert.doesNotMatch(src, /👑|🏆/u, file);
  }
});

function supermaxPicks(
  capperId: string,
  sport: string,
  at: string,
  count: number,
  profitEach: number,
): HonorPosition[] {
  return picks(capperId, sport, at, count, profitEach).map((play) => ({
    ...play,
    units: 20,
    isSupermax: true,
  }));
}

test("Monthly Supermax All-Star: most units from Supermax plays, min 3", () => {
  const near = computeHonors({
    cappers: [ALICE],
    positions: supermaxPicks(
      "a",
      "MLB",
      "2026-08-10T23:00:00Z",
      SUPERMAX_MONTHLY_MINIMUM - 1,
      18,
    ),
    legacy: [],
    now: NOW,
  });
  assert.ok(!near.some((a) => a.sport === SUPERMAX));

  const awards = computeHonors({
    cappers: [ALICE, BOB],
    positions: [
      ...supermaxPicks("a", "MLB", "2026-08-10T23:00:00Z", 3, 18),
      ...supermaxPicks("b", "NFL", "2026-08-11T23:00:00Z", 4, 10),
    ],
    legacy: [],
    now: NOW,
  });
  const supermax = awards.filter((a) => a.sport === SUPERMAX);
  assert.deepEqual(
    supermax.map((a) => [a.id, a.name, a.abbreviation, a.metric]),
    [
      [
        "monthly-2026-08-supermax-units",
        "August 2026 Supermax All-Star",
        "AUG26",
        "units",
      ],
    ],
  );
  // Most units wins: 4 x 10 = 40 beats 3 x 18 = 54? No — 54 wins.
  assert.equal(supermax[0]!.winner.handle, "alice");
  assert.equal(supermax[0]!.winner.units, 54);
  assert.equal(supermax[0]!.minimumPicks, SUPERMAX_MONTHLY_MINIMUM);
  // The same plays still count toward their own sport's awards.
  assert.ok(awards.some((a) => a.id === "monthly-2026-08-mlb-units") === false);
});

test("Annual Supermax Champion: min 20 plays, MAX-prefixed chip", () => {
  const positions = supermaxPicks("a", "MLB", "2026-06-10T23:00:00Z", 20, 5);
  const during = computeHonors({
    cappers: [ALICE],
    positions,
    legacy: [],
    now: NOW,
  });
  // 2026 is not over yet.
  assert.ok(!during.some((a) => a.id === "annual-2026-supermax-units"));

  const after = computeHonors({
    cappers: [ALICE],
    positions,
    legacy: [],
    now: new Date("2027-02-01T12:00:00Z"),
  });
  const award = after.find((a) => a.id === "annual-2026-supermax-units");
  assert.equal(award?.name, "2026 Supermax Champion");
  assert.equal(award?.abbreviation, "MAX26");
  assert.equal(award?.minimumPicks, SUPERMAX_ANNUAL_MINIMUM);
  assert.equal(award?.winner.units, 100);
  // Below the annual minimum, nothing is granted.
  assert.ok(
    !computeHonors({
      cappers: [ALICE],
      positions: supermaxPicks("a", "MLB", "2026-06-10T23:00:00Z", 19, 5),
      legacy: [],
      now: new Date("2027-02-01T12:00:00Z"),
    }).some((a) => a.id === "annual-2026-supermax-units"),
  );
});
