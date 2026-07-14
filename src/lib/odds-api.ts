import "server-only";

import { bookmakersQueryParam, isBookKey } from "@/lib/books";
import {
  normalizeEventBoard,
  normalizeUpcomingEvent,
  type OddsBoardOpts,
  type OddsEvent,
  type OddsSelection,
} from "@/lib/odds-board";
import {
  VERIFY_REGIONS,
  VERIFY_TTL_SECONDS,
  collectAvailablePrices,
  getOddsForBook as getOddsForBookFromEvent,
  verificationMarkets,
  verifyOdds,
  type RawEventOdds,
  type VerifyResult,
} from "@/lib/odds-verify";

export type { OddsEvent, OddsSelection, OddsBoardOpts as OddsFetchOpts };
export {
  getOddsForBook,
  normalizeEventBoard,
  preferredThenAll,
} from "@/lib/odds-board";
export { getOddsForBookFromEvent as getOddsForBookEvent };

/**
 * The Odds API client (odds-assist + auto-grade). Reads ODDS_API_KEY at runtime;
 * every function degrades gracefully to empty when the key or sport isn't available,
 * so the app works with or without a key configured.
 *
 * SCL sport keys (NBA, MLB, …) differ from The Odds API's (basketball_nba, …), so all
 * translation lives here and is shared with the auto-grade results provider.
 *
 * Capper books (M4): when CapperProfile.books is non-empty, requests use `bookmakers=`;
 * empty books keeps today's `regions=us`. Never emit an empty board solely because of the
 * filter — fall back to regions=us. Verification always filters to the capper's books.
 */
const SCL_TO_ODDS_API: Record<string, string> = {
  NFL: "americanfootball_nfl",
  NBA: "basketball_nba",
  NCAAF: "americanfootball_ncaaf",
  NCAAB: "basketball_ncaab",
  MLB: "baseball_mlb",
  NHL: "icehockey_nhl",
  WNBA: "basketball_wnba",
  CFL: "americanfootball_cfl",
};

const ODDS_API_TO_SCL: Record<string, string> = Object.fromEntries(
  Object.entries(SCL_TO_ODDS_API).map(([scl, api]) => [api, scl]),
);

export function toOddsApiSport(sclKey: string): string | undefined {
  return SCL_TO_ODDS_API[sclKey];
}

/** The Odds API key. Accepts the canonical name and the common `ODD_API_KEY` misspelling. */
export function oddsApiKey(): string | undefined {
  return process.env.ODDS_API_KEY || process.env.ODD_API_KEY;
}

export function toSclSport(oddsApiKey: string): string | undefined {
  return ODDS_API_TO_SCL[oddsApiKey];
}

/** Sports we can odds-assist / auto-grade as game moneyline + totals. */
export function oddsAssistSupported(sclKey: string): boolean {
  return sclKey in SCL_TO_ODDS_API;
}

/** regions=us when books empty; else bookmakers=<keys>. */
function oddsScopeQuery(books?: readonly string[]): string {
  const bm = bookmakersQueryParam(books ?? []);
  if (bm) return `bookmakers=${encodeURIComponent(bm)}`;
  return `regions=${VERIFY_REGIONS}`;
}

/** Log Odds API credit usage from a response so burn is observable vs. the plan cap. */
function logOddsUsage(res: Response, label: string): void {
  const remaining = res.headers.get("x-requests-remaining");
  const last = res.headers.get("x-requests-last");
  if (remaining !== null || last !== null) {
    console.info(
      `[odds] ${label}: cost=${last ?? "?"} remaining=${remaining ?? "?"}`,
    );
  }
}

/** Upcoming games with moneyline + totals for a SCL sport. [] when no key/unsupported. */
export async function fetchUpcomingOdds(
  sclSport: string,
  opts?: OddsBoardOpts,
): Promise<OddsEvent[]> {
  const apiKey = oddsApiKey();
  const apiSport = toOddsApiSport(sclSport);
  if (!apiKey || !apiSport) return [];

  const preferred = opts?.books;
  const attempt = async (books: readonly string[] | undefined) => {
    const url =
      `https://api.the-odds-api.com/v4/sports/${apiSport}/odds/` +
      `?apiKey=${apiKey}&${oddsScopeQuery(books)}&markets=h2h,spreads,totals&oddsFormat=american`;
    const res = await fetch(url, { next: { revalidate: 120 } });
    logOddsUsage(res, `upcoming ${sclSport}`);
    if (!res.ok) {
      console.warn(`[odds] upcoming ${sclSport}: HTTP ${res.status}`);
      return [] as OddsEvent[];
    }
    const events = (await res.json()) as Parameters<
      typeof normalizeUpcomingEvent
    >[1][];
    return events
      .map((e) => normalizeUpcomingEvent(sclSport, e, preferred))
      .filter((e) => e.selections.length > 0)
      .slice(0, 60);
  };

  try {
    const board = await attempt(preferred);
    if (board.length > 0) return board;

    // Never empty the board solely because of a bookmakers filter — fall back to regions=us.
    if (bookmakersQueryParam(preferred ?? [])) {
      console.info(
        `[odds] upcoming ${sclSport}: bookmakers filter empty, falling back to regions=us`,
      );
      return await attempt(undefined);
    }
    console.info(`[odds] upcoming ${sclSport}: 0 usable events returned`);
    return board;
  } catch (err) {
    console.warn(`[odds] upcoming ${sclSport}: fetch failed`, err);
    return [];
  }
}

/**
 * One BUNDLED per-event odds call (featured + alternate + curated props), cached for
 * VERIFY_TTL_SECONDS. When `books` is set, requests those bookmakers; falls back to
 * regions=us if the filtered payload has no bookmakers. Returns null when no key /
 * unsupported / fetch fails — caller marks SELF-REPORTED, never rejected.
 */
export async function fetchEventOddsForVerification(
  sclSport: string,
  eventId: string,
  opts?: OddsBoardOpts,
): Promise<RawEventOdds | null> {
  const apiKey = oddsApiKey();
  const apiSport = toOddsApiSport(sclSport);
  if (!apiKey || !apiSport) return null;
  const markets = verificationMarkets(sclSport).join(",");

  const attempt = async (books: readonly string[] | undefined) => {
    const url =
      `https://api.the-odds-api.com/v4/sports/${apiSport}/events/${eventId}/odds/` +
      `?apiKey=${apiKey}&${oddsScopeQuery(books)}&markets=${markets}&oddsFormat=american`;
    const res = await fetch(url, {
      next: { revalidate: VERIFY_TTL_SECONDS, tags: [`odds-event:${eventId}`] },
    });
    logOddsUsage(res, `event ${eventId}`);
    if (!res.ok) return null;
    return (await res.json()) as RawEventOdds;
  };

  try {
    const preferred = opts?.books;
    const event = await attempt(preferred);
    if (event && (event.bookmakers?.length ?? 0) > 0) return event;

    if (bookmakersQueryParam(preferred ?? [])) {
      console.info(
        `[odds] event ${eventId}: bookmakers filter empty, falling back to regions=us`,
      );
      return await attempt(undefined);
    }
    return event;
  } catch {
    return null;
  }
}

/**
 * Fetch + verify a claimed pick price against the live market (one-sided implied-prob bound).
 * When `books` is non-empty, available prices are filtered to those books so verification
 * matches what the capper bets. Empty books = all books on the payload (regions=us).
 */
export async function verifyPick(params: {
  sclSport: string;
  eventId: string;
  marketKeys: string[];
  side: string;
  line?: number;
  player?: string;
  claimedAmerican: number;
  toleranceProb?: number;
  books?: readonly string[];
}): Promise<VerifyResult> {
  const event = await fetchEventOddsForVerification(
    params.sclSport,
    params.eventId,
    { books: params.books },
  );
  if (!event) {
    return {
      status: "unverifiable",
      reason: "Odds unavailable for this event.",
    };
  }
  const bookKeys = (params.books ?? []).filter(isBookKey);
  const availableAmerican = collectAvailablePrices(
    event,
    {
      marketKeys: params.marketKeys,
      side: params.side,
      line: params.line,
      player: params.player,
    },
    bookKeys.length ? { bookKeys } : undefined,
  );
  return verifyOdds({
    claimedAmerican: params.claimedAmerican,
    availableAmerican,
    toleranceProb: params.toleranceProb,
  });
}

/**
 * The full board for one event — featured + alternate game lines — reusing the cached per-event
 * verification fetch, so browsing and verifying the same event share a single credit spend.
 * Returns [] when the event can't be sourced (no key / unsupported / fetch failure).
 */
export async function fetchEventBoard(
  sclSport: string,
  eventId: string,
  opts?: OddsBoardOpts,
): Promise<OddsSelection[]> {
  const event = await fetchEventOddsForVerification(sclSport, eventId, opts);
  if (!event) return [];
  return normalizeEventBoard(event, opts);
}
