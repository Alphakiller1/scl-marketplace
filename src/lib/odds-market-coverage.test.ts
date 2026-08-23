import assert from "node:assert/strict";
import test from "node:test";

import type { OddsEvent, OddsSelection } from "@/lib/odds-board";
import {
  buildOddsCoverageReport,
  summarizeEventMarketCoverage,
} from "@/lib/odds-market-coverage";

const event: OddsEvent = {
  id: "mlb-1",
  sport: "MLB",
  commenceTime: "2026-08-12T23:00:00Z",
  home: "Home",
  away: "Away",
  selections: [],
};

function selection(
  market: string,
  overrides: Partial<OddsSelection> = {},
): OddsSelection {
  return {
    label: `${market} row`,
    market,
    selection: `${market} row`,
    side: "Over",
    oddsAmerican: -110,
    ...overrides,
  };
}

test("MLB coverage distinguishes every requested expanded market family", () => {
  const coverage = summarizeEventMarketCoverage(
    event,
    [
      selection("Spread", { featured: false, line: 1.5 }),
      selection("Total", { featured: false, line: 8.5 }),
      selection("Strikeouts", { player: "Pitcher", line: 5.5 }),
      selection("Earned Runs", { player: "Pitcher", line: 2.5 }),
      selection("Hits", { player: "Batter", line: 1.5 }),
      selection("Total Bases", { player: "Batter", line: 1.5 }),
      // A real ladder, not one rung: the featured market alone tops out at
      // one line per club, and coverage now requires the alternates.
      selection("Team Total", { line: 3.5 }),
      selection("Team Total", { line: 4.5 }),
      selection("Team Total", { line: 5.5 }),
      selection("1st 3 Innings Total", { line: 2.5 }),
      selection("1st 5 Innings Spread", { line: 1.5 }),
      selection("1st 7 Innings Moneyline"),
    ],
    "runtime_cache",
    false,
  );

  assert.equal(coverage.fullyCovered, true);
  assert.equal(coverage.props, 4);
  assert.deepEqual(coverage.propMarkets, [
    "Earned Runs",
    "Hits",
    "Strikeouts",
    "Total Bases",
  ]);
  assert.equal(coverage.alternateGameLines, 2);
  assert.equal(coverage.alternateSpreads, 1);
  assert.equal(coverage.alternateTotals, 1);
  assert.equal(coverage.teamTotals, 3);
  assert.equal(coverage.teamTotalLines, 3);
  assert.deepEqual(coverage.missing, []);
});

test("empty and partial event boards remain visible in the slate report", () => {
  const empty = summarizeEventMarketCoverage(event, [], "cache_empty", false);
  const partial = summarizeEventMarketCoverage(
    { ...event, id: "mlb-2" },
    [selection("Strikeouts", { player: "Pitcher", line: 5.5 })],
    "stale_cache_only",
    true,
  );
  const report = buildOddsCoverageReport([empty, partial]);

  assert.equal(report.cacheComplete, false);
  assert.equal(report.marketComplete, false);
  assert.equal(report.gamesWithExpandedBoard, 1);
  assert.equal(report.gamesFullyCovered, 0);
  assert.ok(empty.missing.includes("expanded board"));
  assert.ok(partial.missing.includes("F5"));
});

test("a game with no team totals is not fully covered", () => {
  // Every other expanded market already had a rule; team totals were counted
  // and then ignored, so a board that came back without the ladder was reported
  // complete and the warmer never returned to fill it.
  const coverage = summarizeEventMarketCoverage(
    event,
    [
      selection("Spread", { featured: false, line: 1.5 }),
      selection("Total", { featured: false, line: 8.5 }),
      selection("Strikeouts", { player: "Pitcher", line: 5.5 }),
      selection("Earned Runs", { player: "Pitcher", line: 2.5 }),
      selection("Hits", { player: "Batter", line: 1.5 }),
      selection("Total Bases", { player: "Batter", line: 1.5 }),
      selection("1st 3 Innings Total", { line: 2.5 }),
      selection("1st 5 Innings Spread", { line: 1.5 }),
      selection("1st 7 Innings Moneyline"),
    ],
    "runtime_cache",
    false,
  );

  assert.equal(coverage.teamTotals, 0);
  assert.equal(coverage.fullyCovered, false);
  assert.deepEqual(coverage.missing, ["team totals"]);
});

test("MLB coverage requires the requested earned-runs, hits, and total-bases families", () => {
  const coverage = summarizeEventMarketCoverage(
    event,
    [selection("Strikeouts", { player: "Pitcher", line: 5.5 })],
    "runtime_cache",
    false,
  );

  assert.deepEqual(coverage.missing.slice(0, 3), [
    "alternate spreads",
    "alternate totals",
    "Earned Runs props",
  ]);
  assert.ok(coverage.missing.includes("Hits props"));
  assert.ok(coverage.missing.includes("Total Bases props"));
  assert.equal(coverage.fullyCovered, false);
});

test("sports without an expanded board are not asked for team totals", () => {
  // NHL requests no expanded board at all, so absent team totals there are not
  // a gap — otherwise the report would demand a market nothing fetches.
  const nhl = summarizeEventMarketCoverage(
    { ...event, id: "nhl-1", sport: "NHL" },
    [selection("Total", { featured: false, line: 5.5 })],
    "runtime_cache",
    false,
  );
  assert.equal(nhl.missing.includes("team totals"), false);
});

test("tennis coverage requires alternate full-match spreads and totals", () => {
  const tennisEvent = {
    ...event,
    id: "tennis-1",
    sport: "TENNIS",
    league: "ATP_US_OPEN",
  };
  const complete = summarizeEventMarketCoverage(
    tennisEvent,
    [
      selection("Spread", { featured: false, line: 2.5 }),
      selection("Total", { featured: false, line: 22.5 }),
    ],
    "runtime_cache",
    false,
  );
  assert.equal(complete.fullyCovered, true);
  assert.equal(complete.league, "ATP_US_OPEN");

  const partial = summarizeEventMarketCoverage(
    tennisEvent,
    [selection("Spread", { featured: false, line: 2.5 })],
    "runtime_cache",
    false,
  );
  assert.deepEqual(partial.missing, ["alternate totals"]);
});

// ── alternate team totals ────────────────────────────────────────────────────
// The owner asked for alt team totals and they were missing on ten of fifteen
// MLB games. Coverage counted team totals as present the moment ONE existed, so
// a game holding only the featured line read as fully covered and
// `skipPopulated` skipped it on every later run — the ladder never arrived.
function mlbEvent(): Parameters<typeof summarizeEventMarketCoverage>[0] {
  return {
    id: "tt-cov",
    sport: "MLB",
    commenceTime: "2026-08-23T18:10:00Z",
    home: "Kansas City Royals",
    away: "Detroit Tigers",
    selections: [],
  };
}

function teamTotalSelections(lines: number[]) {
  return lines.flatMap((line) =>
    (["Over", "Under"] as const).map((side) => ({
      label: `Royals ${side} ${line}`,
      market: "Team Total",
      selection: `Kansas City Royals ${side} ${line}`,
      side,
      line,
      featured: false,
      oddsAmerican: -110,
    })),
  );
}

test("a featured-only team total is not full coverage", () => {
  const coverage = summarizeEventMarketCoverage(
    mlbEvent(),
    teamTotalSelections([4.5]),
    "runtime_cache",
    false,
  );
  assert.equal(coverage.teamTotals > 0, true, "team totals are present");
  assert.equal(coverage.teamTotalLines, 1);
  assert.ok(
    coverage.missing.includes("alternate team totals"),
    `expected the alternate ladder to be missing, got ${JSON.stringify(coverage.missing)}`,
  );
});

test("one line per club is still only the featured market", () => {
  const coverage = summarizeEventMarketCoverage(
    mlbEvent(),
    teamTotalSelections([4.5, 3.5]),
    "runtime_cache",
    false,
  );
  assert.equal(coverage.teamTotalLines, 2);
  assert.ok(coverage.missing.includes("alternate team totals"));
});

test("a real ladder satisfies the team-total requirement", () => {
  const coverage = summarizeEventMarketCoverage(
    mlbEvent(),
    teamTotalSelections([2.5, 3.5, 4.5, 5.5, 6.5]),
    "runtime_cache",
    false,
  );
  assert.equal(coverage.teamTotalLines, 5);
  assert.equal(coverage.missing.includes("alternate team totals"), false);
  assert.equal(coverage.missing.includes("team totals"), false);
});

test("no team totals at all still reports the base gap, not the ladder", () => {
  const coverage = summarizeEventMarketCoverage(
    mlbEvent(),
    [],
    "runtime_cache",
    false,
  );
  assert.ok(coverage.missing.includes("team totals"));
  assert.equal(coverage.missing.includes("alternate team totals"), false);
});
