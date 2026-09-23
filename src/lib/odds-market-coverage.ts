import type { OddsEvent, OddsSelection } from "@/lib/odds-board";
import { parsePeriodMarket } from "@/lib/period-markets";
import {
  expandedBoardMarkets,
  PRIMARY_MLB_PROP_MARKETS,
  PROP_MARKET_LABEL,
  propMarketLabel,
} from "@/lib/odds-verify";
import { isDoubleChanceMarket } from "@/lib/soccer-markets";
import {
  ALTERNATE_TEAM_TOTAL_MARKET_KEY,
  isTeamTotalMarket,
  MIN_TEAM_TOTAL_LADDER_LINES,
  parseTeamTotalSelection,
  TEAM_TOTAL_MARKET_KEYS,
} from "@/lib/team-total-markets";

/**
 * Does this sport's expanded board actually ask for team totals?
 *
 * Derived from the request list rather than a second hardcoded sport set, so a
 * sport that gains or loses team totals cannot end up with a coverage rule that
 * disagrees with what is fetched.
 */
function requestedMarketsForSport(
  sport: string,
  wantedMarkets?: readonly string[],
): string[] {
  return wantedMarkets?.length
    ? [...wantedMarkets]
    : expandedBoardMarkets(sport);
}

function requestsTeamTotals(markets: readonly string[]): boolean {
  return TEAM_TOTAL_MARKET_KEYS.some((key) => markets.includes(key));
}

const PROP_LABELS = new Set(
  Object.values(PROP_MARKET_LABEL).map((label) => label.toLowerCase()),
);
/** Gap labels the team-total rule writes, and the top-up keys off. */
export const TEAM_TOTALS_GAP = "team totals";
export const ALTERNATE_TEAM_TOTALS_GAP = "alternate team totals";
export const DRAFTKINGS_ALTERNATE_SPREADS_GAP = "DraftKings alternate spreads";
export const DRAFTKINGS_ALTERNATE_TOTALS_GAP = "DraftKings alternate totals";

function requestsHalves(markets: readonly string[]): boolean {
  return markets.some((key) => /_h[12]$/.test(key));
}

function requestsPlayerProps(markets: readonly string[]): boolean {
  return markets.some(
    (key) =>
      key.startsWith("player_") ||
      key.startsWith("pitcher_") ||
      key.startsWith("batter_"),
  );
}

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
  /** Clubs carrying their OWN ladder — at least
   *  {@link MIN_TEAM_TOTAL_LADDER_LINES} distinct lines. A game is covered only
   *  when both clubs do. */
  teamTotalLadderClubs: number;
  /** Soccer only — the three Double Chance combinations. */
  doubleChance: number;
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
  wantedMarkets?: readonly string[],
): EventMarketCoverage {
  const sport = event.sport.toUpperCase();
  const wanted = requestedMarketsForSport(sport, wantedMarkets);
  let props = 0;
  const propMarkets = new Set<string>();
  let alternateGameLines = 0;
  let alternateSpreads = 0;
  let alternateTotals = 0;
  let draftKingsAlternateSpreads = 0;
  let draftKingsAlternateTotals = 0;
  let draftKingsSelections = 0;
  let teamTotals = 0;
  const teamTotalLines = new Set<number>();
  const teamTotalLinesByClub = new Map<string, Set<number>>();
  let doubleChance = 0;
  let f3 = 0;
  let f5 = 0;
  let f7 = 0;
  let halves = 0;

  for (const selection of selections) {
    const hasDraftKings = typeof selection.bookPrices?.draftkings === "number";
    if (hasDraftKings) draftKingsSelections++;
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
      if (selection.market === "Spread" && hasDraftKings) {
        draftKingsAlternateSpreads++;
      }
      if (selection.market === "Total" && hasDraftKings) {
        draftKingsAlternateTotals++;
      }
    }
    if (isTeamTotalMarket(selection.market)) {
      teamTotals++;
      if (typeof selection.line === "number") {
        teamTotalLines.add(selection.line);
        const club = parseTeamTotalSelection(selection.selection)?.team;
        if (club) {
          const key = club.toLowerCase();
          const lines = teamTotalLinesByClub.get(key) ?? new Set<number>();
          lines.add(selection.line);
          teamTotalLinesByClub.set(key, lines);
        }
      }
    }
    if (isDoubleChanceMarket(selection.market)) doubleChance++;
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
  } else if (sport === "SOCCER") {
    // Soccer's expanded call asks for Double Chance and nothing else, so an
    // alternate-ladder rule here would mark every fixture incomplete forever
    // and make `skipPopulated` re-bill the whole slate on every run.
    if (doubleChance === 0) missing.push("double chance");
  } else {
    // Only demand markets this sport's expanded board actually fetches.
    // NCAAF asks for alternate spreads/totals and nothing else; requiring
    // halves and player props (which live on other football sports) made every
    // NCAAF board look incomplete forever. NFL's owner-toggled game ladder
    // is the same rule: do not chase alt lines or team totals unless asked.
    if (wanted.includes("alternate_spreads") && alternateSpreads === 0) {
      missing.push("alternate spreads");
    }
    if (wanted.includes("alternate_totals") && alternateTotals === 0) {
      missing.push("alternate totals");
    }
    // DraftKings publishes MLB/NCAAF alternate rungs under the featured
    // spreads/totals keys. A board can therefore look complete because another
    // book filled `alternate_spreads` while every DK chip is disabled. Only
    // demand the companion when DK prices something on this event at all.
    if (
      (sport === "MLB" || sport === "NCAAF") &&
      draftKingsSelections > 0 &&
      wanted.includes("alternate_spreads") &&
      alternateSpreads > 0 &&
      draftKingsAlternateSpreads === 0
    ) {
      missing.push(DRAFTKINGS_ALTERNATE_SPREADS_GAP);
    }
    if (
      (sport === "MLB" || sport === "NCAAF") &&
      draftKingsSelections > 0 &&
      wanted.includes("alternate_totals") &&
      alternateTotals > 0 &&
      draftKingsAlternateTotals === 0
    ) {
      missing.push(DRAFTKINGS_ALTERNATE_TOTALS_GAP);
    }
  }
  if (requestsPlayerProps(wanted) && props === 0) {
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
  const teamTotalLadderClubs = [...teamTotalLinesByClub.values()].filter(
    (lines) => lines.size >= MIN_TEAM_TOTAL_LADDER_LINES,
  ).length;
  if (requestsTeamTotals(wanted)) {
    if (teamTotals === 0) {
      missing.push(TEAM_TOTALS_GAP);
    } else if (teamTotalLadderClubs < 2) {
      // The ladder is judged PER CLUB. The rule this replaces counted distinct
      // lines across the whole game and called anything above two a ladder,
      // on the theory that the featured market prices one line per club. The
      // books do not agree on that one line: on 2026-09-15 FanDuel and
      // DraftKings hung the Phillies at 4.5, Fanatics at 7.5, and the Nationals
      // sat at 2.5 — three distinct lines, so "covered" — with no ladder for
      // either club. Seven of fifteen games looked like that, every later pass
      // skipped them, and no Over 2.5 for the Phillies, Dodgers or Rays ever
      // reached the board. See MIN_TEAM_TOTAL_LADDER_LINES for the threshold.
      missing.push(ALTERNATE_TEAM_TOTALS_GAP);
    }
  }
  if (sport === "MLB") {
    if (wanted.some((key) => key.includes("1st_3_innings")) && f3 === 0) {
      missing.push("F3");
    }
    if (wanted.some((key) => key.includes("1st_5_innings")) && f5 === 0) {
      missing.push("F5");
    }
    if (wanted.some((key) => key.includes("1st_7_innings")) && f7 === 0) {
      missing.push("F7");
    }
  }
  if (requestsHalves(wanted) && halves === 0) {
    missing.push("halves");
  }

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
    teamTotalLadderClubs,
    doubleChance,
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

/**
 * The team-total keys a top-up should buy — when team totals are the ONLY gap.
 *
 * Anything else missing means the board needs a real refresh, and a refresh
 * requests team totals along with everything else, so a separate top-up would
 * pay for them twice. Null rather than an empty list, so "nothing to top up"
 * cannot be mistaken for "top up nothing".
 */
export function teamTotalGapMarkets(
  missing: readonly string[],
): string[] | null {
  if (missing.length === 0) return null;
  const onlyTeamTotals = missing.every(
    (gap) => gap === TEAM_TOTALS_GAP || gap === ALTERNATE_TEAM_TOTALS_GAP,
  );
  if (!onlyTeamTotals) return null;
  return missing.includes(TEAM_TOTALS_GAP)
    ? [...TEAM_TOTAL_MARKET_KEYS]
    : [ALTERNATE_TEAM_TOTAL_MARKET_KEY];
}

/**
 * Cheap companion-market top-up for a board whose only missing coverage is
 * DraftKings' alternate game ladder. This asks for one or two featured keys,
 * not the entire MLB prop card, and is safe even after the daily board cap.
 */
export function draftKingsCompanionGapMarkets(
  missing: readonly string[],
): string[] | null {
  const markets = [
    ...(missing.includes(DRAFTKINGS_ALTERNATE_SPREADS_GAP) ? ["spreads"] : []),
    ...(missing.includes(DRAFTKINGS_ALTERNATE_TOTALS_GAP) ? ["totals"] : []),
  ];
  // Unlike a full-board refresh, this costs only one credit per returned key.
  // It can repair DK now even when an unrelated prop family is also missing
  // and today's full-board buy cap correctly prevents another expensive pass.
  return markets.length > 0 ? markets : null;
}
