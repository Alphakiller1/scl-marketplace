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
      selection("Team Total", { line: 4.5 }),
      selection("1st 3 Innings Total", { line: 2.5 }),
      selection("1st 5 Innings Spread", { line: 1.5 }),
      selection("1st 7 Innings Moneyline"),
    ],
    "runtime_cache",
    false,
  );

  assert.equal(coverage.fullyCovered, true);
  assert.equal(coverage.props, 1);
  assert.equal(coverage.alternateGameLines, 2);
  assert.equal(coverage.alternateSpreads, 1);
  assert.equal(coverage.alternateTotals, 1);
  assert.equal(coverage.teamTotals, 1);
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
