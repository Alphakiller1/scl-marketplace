import assert from "node:assert/strict";
import test from "node:test";

import type { OddsEvent, OddsSelection } from "@/lib/odds-board";
import {
  buildOddsCoverageReport,
  draftKingsCompanionGapMarkets,
  DRAFTKINGS_ALTERNATE_SPREADS_GAP,
  DRAFTKINGS_ALTERNATE_TOTALS_GAP,
  summarizeEventMarketCoverage,
  onlyTopUpGaps,
  teamTotalGapMarkets,
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
      // A real ladder for BOTH clubs: coverage judges each club's own lines.
      ...teamTotalSelections([2.5, 3.5, 4.5, 5.5]),
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
  assert.equal(coverage.teamTotals, 16);
  assert.equal(coverage.teamTotalLines, 4);
  assert.equal(coverage.teamTotalLadderClubs, 2);
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

test("NCAAF coverage is the two alternate ladders, not halves or props", () => {
  // NCAAF expanded fetches only alternate_spreads and alternate_totals. The
  // football half/prop rules are for NFL; applying them here made every NCAAF
  // board look incomplete, so skipPopulated never learned and the run kept
  // reporting a gap that nothing would fill.
  const ncaafEvent = {
    ...event,
    id: "ncaaf-1",
    sport: "NCAAF",
  };
  const complete = summarizeEventMarketCoverage(
    ncaafEvent,
    [
      selection("Spread", { featured: false, line: 7.5 }),
      selection("Total", { featured: false, line: 48.5 }),
    ],
    "runtime_cache",
    false,
  );
  assert.deepEqual(complete.missing, []);
  assert.equal(complete.fullyCovered, true);

  const featuredOnly = summarizeEventMarketCoverage(
    ncaafEvent,
    [
      selection("Spread", { featured: true, line: 7.5 }),
      selection("Total", { featured: true, line: 48.5 }),
    ],
    "runtime_cache",
    false,
  );
  assert.deepEqual(featuredOnly.missing, [
    "alternate spreads",
    "alternate totals",
  ]);
});

test("tennis coverage is complete with featured game spreads and totals", () => {
  const tennisEvent = {
    ...event,
    id: "tennis-1",
    sport: "TENNIS",
    league: "ATP_US_OPEN",
  };
  const complete = summarizeEventMarketCoverage(
    tennisEvent,
    [
      selection("Spread", { featured: true, line: 5.5 }),
      selection("Total", { featured: true, line: 22.5 }),
    ],
    "runtime_cache",
    false,
  );
  assert.equal(complete.fullyCovered, true);
  assert.equal(complete.league, "ATP_US_OPEN");

  const partial = summarizeEventMarketCoverage(
    tennisEvent,
    [selection("Spread", { featured: true, line: 5.5 })],
    "runtime_cache",
    false,
  );
  assert.deepEqual(partial.missing, ["totals"]);
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

function teamTotalSelections(
  lines: number[],
  clubs: readonly string[] = ["Kansas City Royals", "Detroit Tigers"],
): OddsSelection[] {
  return clubs.flatMap((club) =>
    lines.flatMap((line) =>
      (["Over", "Under"] as const).map((side) => ({
        label: `${club} ${side} ${line}`,
        market: "Team Total",
        selection: `${club} ${side} ${line}`,
        side,
        line,
        featured: false,
        oddsAmerican: -110,
      })),
    ),
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

// ── the ladder is judged per club ────────────────────────────────────────────
// 2026-09-15: seven of fifteen MLB boards carried only featured team totals.
// The rule counted distinct lines across BOTH clubs, so books hanging the
// featured line at different numbers pushed the count past two and read as a
// ladder — and every later pass skipped the board.
test("Phillies at Nationals: three featured lines across two clubs is no ladder", () => {
  const selections = [
    ...teamTotalSelections([4.5, 7.5], ["Philadelphia Phillies"]),
    ...teamTotalSelections([2.5], ["Washington Nationals"]),
  ];
  const coverage = summarizeEventMarketCoverage(
    mlbEvent(),
    selections,
    "runtime_cache",
    false,
  );
  assert.equal(
    coverage.teamTotalLines,
    3,
    "the board-wide count the old rule called a ladder",
  );
  assert.equal(coverage.teamTotalLadderClubs, 0);
  assert.ok(coverage.missing.includes("alternate team totals"));
});

test("one club's ladder does not cover the other club", () => {
  const coverage = summarizeEventMarketCoverage(
    mlbEvent(),
    [
      ...teamTotalSelections(
        [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5],
        ["Chicago Cubs"],
      ),
      ...teamTotalSelections([3.5], ["Atlanta Braves"]),
    ],
    "runtime_cache",
    false,
  );
  assert.equal(coverage.teamTotalLadderClubs, 1);
  assert.ok(coverage.missing.includes("alternate team totals"));
});

test("a team-total gap names its top-up keys whatever else is missing", () => {
  assert.deepEqual(teamTotalGapMarkets(["alternate team totals"]), [
    "alternate_team_totals",
  ]);
  assert.deepEqual(teamTotalGapMarkets(["team totals"]), [
    "team_totals",
    "alternate_team_totals",
  ]);
  // A second gap used to hide the ladder entirely — from the top-up AND from
  // the gap count that schedules the catch-up.
  assert.deepEqual(teamTotalGapMarkets(["alternate team totals", "F7"]), [
    "alternate_team_totals",
  ]);
  assert.deepEqual(
    teamTotalGapMarkets([
      DRAFTKINGS_ALTERNATE_SPREADS_GAP,
      DRAFTKINGS_ALTERNATE_TOTALS_GAP,
      "alternate team totals",
    ]),
    ["alternate_team_totals"],
  );
  assert.equal(teamTotalGapMarkets(["F7"]), null);
  assert.equal(teamTotalGapMarkets([]), null);
});

test("only top-up gaps skip the rebuy; anything else still earns one", () => {
  assert.equal(
    onlyTopUpGaps([
      DRAFTKINGS_ALTERNATE_SPREADS_GAP,
      DRAFTKINGS_ALTERNATE_TOTALS_GAP,
      "alternate team totals",
    ]),
    true,
  );
  assert.equal(onlyTopUpGaps(["team totals"]), true);
  assert.equal(onlyTopUpGaps(["alternate team totals", "F7"]), false);
  assert.equal(onlyTopUpGaps([]), false);
});

test("Braves@Reds 2026-09-24: a DK featured-only board still reports its thin ladder", () => {
  // Shape of the live board: DraftKings prices props and the featured game
  // line but no alternate rungs, and each club carries 2-3 team-total lines.
  const teamTotal = (team: string, line: number, book: string) => [
    selection("Team Total", {
      selection: `${team} Over ${line}`,
      side: "Over",
      line,
      featured: false,
      bookPrices: { [book]: -110 },
    }),
    selection("Team Total", {
      selection: `${team} Under ${line}`,
      side: "Under",
      line,
      featured: false,
      bookPrices: { [book]: -110 },
    }),
  ];
  const coverage = summarizeEventMarketCoverage(
    event,
    [
      selection("Spread", {
        featured: true,
        line: -1.5,
        bookPrices: { draftkings: -150 },
      }),
      selection("Spread", {
        featured: false,
        line: -2.5,
        bookPrices: { fanduel: 120 },
      }),
      selection("Total", {
        featured: false,
        line: 9.5,
        bookPrices: { fanduel: -105 },
      }),
      ...teamTotal("Atlanta Braves", 2.5, "fanatics"),
      ...teamTotal("Atlanta Braves", 4.5, "williamhill_us"),
      ...teamTotal("Cincinnati Reds", 1.5, "fanatics"),
      ...teamTotal("Cincinnati Reds", 2.5, "fanduel"),
      ...teamTotal("Cincinnati Reds", 3.5, "williamhill_us"),
    ],
    "runtime_cache",
    false,
    [
      "alternate_spreads",
      "alternate_totals",
      "team_totals",
      "alternate_team_totals",
    ],
  );
  assert.ok(coverage.missing.includes(DRAFTKINGS_ALTERNATE_SPREADS_GAP));
  assert.ok(coverage.missing.includes("alternate team totals"));
  assert.deepEqual(teamTotalGapMarkets(coverage.missing), [
    "alternate_team_totals",
  ]);
});

test("an MLB board with DraftKings but no DK alternate rungs gets a cheap companion top-up", () => {
  const coverage = summarizeEventMarketCoverage(
    event,
    [
      selection("Spread", {
        featured: false,
        line: -1,
        bookPrices: { fanduel: -108 },
      }),
      selection("Total", {
        featured: false,
        line: 8.5,
        bookPrices: { fanduel: -110 },
      }),
      selection("Moneyline", {
        side: "Arizona Diamondbacks",
        bookPrices: { draftkings: -105 },
      }),
    ],
    "runtime_cache",
    false,
    ["alternate_spreads", "alternate_totals"],
  );

  assert.ok(coverage.missing.includes(DRAFTKINGS_ALTERNATE_SPREADS_GAP));
  assert.ok(coverage.missing.includes(DRAFTKINGS_ALTERNATE_TOTALS_GAP));
  assert.deepEqual(draftKingsCompanionGapMarkets(coverage.missing), [
    "spreads",
    "totals",
  ]);
});

test("DraftKings companion coverage passes once its -1 rung is present", () => {
  const coverage = summarizeEventMarketCoverage(
    event,
    [
      selection("Spread", {
        featured: false,
        line: -1,
        bookPrices: { draftkings: -172, fanduel: -168 },
      }),
      selection("Total", {
        featured: false,
        line: 8.5,
        bookPrices: { draftkings: -110, fanduel: -108 },
      }),
    ],
    "runtime_cache",
    false,
    ["alternate_spreads", "alternate_totals"],
  );

  assert.deepEqual(coverage.missing, []);
  assert.equal(draftKingsCompanionGapMarkets(coverage.missing), null);
  assert.deepEqual(
    draftKingsCompanionGapMarkets([
      DRAFTKINGS_ALTERNATE_SPREADS_GAP,
      "player props",
    ]),
    ["spreads"],
  );
});

test("NFL coverage does not demand the game ladder unless those keys were requested", () => {
  const nflEvent = { ...event, id: "nfl-1", sport: "NFL" };
  const ladderOff = summarizeEventMarketCoverage(
    nflEvent,
    [selection("Passing Yds", { player: "QB", line: 250.5 })],
    "runtime_cache",
    false,
    ["player_pass_yds"],
  );
  assert.equal(ladderOff.missing.includes("alternate spreads"), false);
  assert.equal(ladderOff.missing.includes("alternate totals"), false);
  assert.equal(ladderOff.missing.includes("team totals"), false);

  const ladderOn = summarizeEventMarketCoverage(
    nflEvent,
    [selection("Passing Yds", { player: "QB", line: 250.5 })],
    "runtime_cache",
    false,
    ["player_pass_yds", "alternate_spreads", "team_totals"],
  );
  assert.ok(ladderOn.missing.includes("alternate spreads"));
  assert.ok(ladderOn.missing.includes("team totals"));
});
