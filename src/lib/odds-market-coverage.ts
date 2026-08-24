import type { OddsEvent, OddsSelection } from "@/lib/odds-board";
import { parsePeriodMarket } from "@/lib/period-markets";
import {
  expandedBoardMarkets,
  PRIMARY_MLB_PROP_MARKETS,
  PROP_MARKET_LABEL,
  PROP_MARKETS_BY_SPORT,
  propMarketLabel,
} from "@/lib/odds-verify";
import {
  isTeamTotalMarket,
  TEAM_TOTAL_MARKET_KEYS,
} from "@/lib/team-total-markets";

/**
 * Does this sport's expanded board actually ask for team totals?
 *
 * Derived from the request list rather than a second hardcoded sport set, so a
 * sport that gains or loses team totals cannot end up with a coverage rule that
 * disagrees with what is fetched.
 */
function requestsTeamTotals(sport: string): boolean {
  const markets = expandedBoardMarkets(sport);
  return TEAM_TOTAL_MARKET_KEYS.some((key) => markets.includes(key));
}

const PROP_LABELS = new Set(
  Object.values(PROP_MARKET_LABEL).map((label) => label.toLowerCase()),
);
/** The featured team-total market prices one line per club — no more. */
const FEATURED_TEAM_TOTAL_LINES = 2;

const HALF_SPORTS = new Set(["CFL", "NFL", "NCAAF", "NBA", "NCAAB", "WNBA"]);

export type EventMarketCoverage = {
  eventId: string;
  sport: string;
  league?: string;
  matchup: string;
  commenceTime: string;
  source: string;
  stale: boolean;
  selectionCount: number;
  props: number;
  propMarkets: string[];
  alternateGameLines: number;
  alternateSpreads: number;
  alternateTotals: number;
  teamTotals: number;
  /** Distinct team-total LINES. The featured market yields at most one per
   *  club, so anything above that is the alternate ladder. */
  teamTotalLines: number;
  f3: number;
  f5: number;
  f7: number;
  halves: number;
  cacheCovered: boolean;
  fullyCovered: boolean;
  missing: string[];
};

export function summarizeEventMarketCoverage(
  event: OddsEvent,
  selections: readonly OddsSelection[],
  source: string,
  stale: boolean,
): EventMarketCoverage {
  const sport = event.sport.toUpperCase();
  let props = 0;
  const propMarkets = new Set<string>();
  let alternateGameLines = 0;
  let alternateSpreads = 0;
  let alternateTotals = 0;
  let teamTotals = 0;
  const teamTotalLines = new Set<number>();
  let f3 = 0;
  let f5 = 0;
  let f7 = 0;
  let halves = 0;

  for (const selection of selections) {
    const period = parsePeriodMarket(selection.market);
    if (
      selection.player ||
      PROP_LABELS.has(selection.market.trim().toLowerCase())
    ) {
      props++;
      propMarkets.add(selection.market);
    }
    if (
      !period &&
      selection.featured === false &&
      (selection.market === "Spread" || selection.market === "Total")
    ) {
      alternateGameLines++;
      if (selection.market === "Spread") alternateSpreads++;
      if (selection.market === "Total") alternateTotals++;
    }
    if (isTeamTotalMarket(selection.market)) {
      teamTotals++;
      if (typeof selection.line === "number")
        teamTotalLines.add(selection.line);
    }
    if (period?.innings === 3) f3++;
    if (period?.innings === 5) f5++;
    if (period?.innings === 7) f7++;
    if (period?.innings === 0) halves++;
  }

  const missing: string[] = [];
  if (selections.length === 0) missing.push("expanded board");
  if (sport === "TENNIS") {
    // Tennis often has a single featured game spread/total (Bovada) and no
    // alternate ladder. Requiring featured:false rows made skipPopulated
    // refetch every match forever while the main lines were already cached.
    if (!selections.some((row) => row.market === "Spread")) {
      missing.push("spreads");
    }
    if (!selections.some((row) => row.market === "Total")) {
      missing.push("totals");
    }
  } else {
    if (alternateSpreads === 0) missing.push("alternate spreads");
    if (alternateTotals === 0) missing.push("alternate totals");
  }
  if ((PROP_MARKETS_BY_SPORT[sport]?.length ?? 0) > 0 && props === 0) {
    missing.push("player props");
  }
  // "Some props" is not complete MLB coverage. A strikeouts-only snapshot used
  // to pass this gate, so manual top-ups skipped it forever even when the three
  // most requested baseball families were absent.
  if (sport === "MLB" && props > 0) {
    const normalizedPresent = new Set(
      [...propMarkets].map((market) => market.trim().toLowerCase()),
    );
    for (const key of PRIMARY_MLB_PROP_MARKETS) {
      const label = propMarketLabel(key);
      if (label && !normalizedPresent.has(label.toLowerCase())) {
        missing.push(`${label} props`);
      }
    }
  }
  // Counted since this report was written, but never checked — so a game whose
  // snapshot came back with no team totals was reported fullyCovered and the
  // warmer never returned to fill them. Every other expanded market has a rule
  // here; team totals were the one gap, which made them the one market that
  // could stay permanently thin no matter how often the refresh ran.
  if (requestsTeamTotals(sport)) {
    if (teamTotals === 0) {
      missing.push("team totals");
    } else if (teamTotalLines.size <= FEATURED_TEAM_TOTAL_LINES) {
      // Counting team totals as present the moment ONE exists is what hid
      // this: the featured `team_totals` market returns a single line per
      // club, so a game with four selections and no ladder at all read as
      // fully covered. `skipPopulated` then skipped it on every later run,
      // so the alternate rungs never arrived even once books posted them —
      // ten of fifteen MLB games sat that way while four had thirteen lines.
      //
      // Two lines is the most the featured market can produce (one per
      // club), so at or below it the alternate ladder is absent, not thin.
      missing.push("alternate team totals");
    }
  }
  if (sport === "MLB") {
    if (f3 === 0) missing.push("F3");
    if (f5 === 0) missing.push("F5");
    if (f7 === 0) missing.push("F7");
  }
  if (HALF_SPORTS.has(sport) && halves === 0) missing.push("halves");

  return {
    eventId: event.id,
    sport,
    ...(event.league ? { league: event.league } : {}),
    matchup: `${event.away} @ ${event.home}`,
    commenceTime: event.commenceTime,
    source,
    stale,
    selectionCount: selections.length,
    props,
    propMarkets: [...propMarkets].sort((a, b) => a.localeCompare(b)),
    alternateGameLines,
    alternateSpreads,
    alternateTotals,
    teamTotals,
    teamTotalLines: teamTotalLines.size,
    f3,
    f5,
    f7,
    halves,
    cacheCovered: selections.length > 0,
    fullyCovered: missing.length === 0,
    missing,
  };
}

export function buildOddsCoverageReport(games: EventMarketCoverage[]) {
  const bySport: Record<
    string,
    { games: number; cacheCovered: number; fullyCovered: number }
  > = {};
  for (const game of games) {
    const row = (bySport[game.sport] ??= {
      games: 0,
      cacheCovered: 0,
      fullyCovered: 0,
    });
    row.games++;
    if (game.cacheCovered) row.cacheCovered++;
    if (game.fullyCovered) row.fullyCovered++;
  }
  return {
    totalGames: games.length,
    gamesWithExpandedBoard: games.filter((game) => game.cacheCovered).length,
    gamesFullyCovered: games.filter((game) => game.fullyCovered).length,
    cacheComplete: games.every((game) => game.cacheCovered),
    marketComplete: games.every((game) => game.fullyCovered),
    bySport,
    games,
  };
}

export type OddsCoverageReport = ReturnType<typeof buildOddsCoverageReport>;
