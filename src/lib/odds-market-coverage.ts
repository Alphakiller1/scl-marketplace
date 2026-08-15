import type { OddsEvent, OddsSelection } from "@/lib/odds-board";
import { parsePeriodMarket } from "@/lib/period-markets";
import {
  expandedBoardMarkets,
  PROP_MARKET_LABEL,
  PROP_MARKETS_BY_SPORT,
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
const HALF_SPORTS = new Set(["CFL", "NFL", "NCAAF", "NBA", "NCAAB", "WNBA"]);

export type EventMarketCoverage = {
  eventId: string;
  sport: string;
  matchup: string;
  commenceTime: string;
  source: string;
  stale: boolean;
  selectionCount: number;
  props: number;
  alternateGameLines: number;
  alternateSpreads: number;
  alternateTotals: number;
  teamTotals: number;
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
  let alternateGameLines = 0;
  let alternateSpreads = 0;
  let alternateTotals = 0;
  let teamTotals = 0;
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
    if (isTeamTotalMarket(selection.market)) teamTotals++;
    if (period?.innings === 3) f3++;
    if (period?.innings === 5) f5++;
    if (period?.innings === 7) f7++;
    if (period?.innings === 0) halves++;
  }

  const missing: string[] = [];
  if (selections.length === 0) missing.push("expanded board");
  if (alternateSpreads === 0) missing.push("alternate spreads");
  if (alternateTotals === 0) missing.push("alternate totals");
  if ((PROP_MARKETS_BY_SPORT[sport]?.length ?? 0) > 0 && props === 0) {
    missing.push("player props");
  }
  // Counted since this report was written, but never checked — so a game whose
  // snapshot came back with no team totals was reported fullyCovered and the
  // warmer never returned to fill them. Every other expanded market has a rule
  // here; team totals were the one gap, which made them the one market that
  // could stay permanently thin no matter how often the refresh ran.
  if (requestsTeamTotals(sport) && teamTotals === 0) {
    missing.push("team totals");
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
    matchup: `${event.away} @ ${event.home}`,
    commenceTime: event.commenceTime,
    source,
    stale,
    selectionCount: selections.length,
    props,
    alternateGameLines,
    alternateSpreads,
    alternateTotals,
    teamTotals,
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
