import type { OddsEvent, OddsSelection } from "@/lib/odds-board";
import { parsePeriodMarket } from "@/lib/period-markets";
import { PROP_MARKET_LABEL, PROP_MARKETS_BY_SPORT } from "@/lib/odds-verify";
import { isTeamTotalMarket } from "@/lib/team-total-markets";

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
    }
    if (isTeamTotalMarket(selection.market)) teamTotals++;
    if (period?.innings === 3) f3++;
    if (period?.innings === 5) f5++;
    if (period?.innings === 7) f7++;
    if (period?.innings === 0) halves++;
  }

  const missing: string[] = [];
  if (selections.length === 0) missing.push("expanded board");
  if (alternateGameLines === 0) missing.push("alternate game lines");
  if ((PROP_MARKETS_BY_SPORT[sport]?.length ?? 0) > 0 && props === 0) {
    missing.push("player props");
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
