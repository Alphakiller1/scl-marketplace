import "server-only";

import { bookmakersQueryParam, isBookKey } from "@/lib/books";
import { shouldCircuitBreak } from "@/lib/odds-budget";
import {
  SOCCER_LEAGUES,
  SOCCER_LEAGUE_LIMIT,
  selectSoccerLeagues,
  soccerLeagueByKey,
  type OddsApiSportRow,
  type SoccerLeague,
} from "@/lib/soccer-leagues";
import { prisma } from "@/lib/prisma";
import {
  dedupeOddsEvents,
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
  liveLineAmerican,
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
 * Monthly budget: 20,000 credits (board warm, verify, results cron, CLV).
 * See docs/qa/SCL_GPT_CLAUDE_DELIVERABLES.md Step 5 and src/lib/odds-budget.ts.
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

/** Resolve Odds API sport key — soccer uses per-league keys. */
export function resolveOddsApiSport(
  sclSport: string,
  league?: string | null,
): string | undefined {
  if (sclSport === "SOCCER") {
    if (!league) return undefined;
    return soccerLeagueByKey(league)?.oddsApiKey;
  }
  return toOddsApiSport(sclSport);
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
  return sclKey in SCL_TO_ODDS_API || sclKey === "SOCCER";
}

/** regions=us when books empty; else bookmakers=<keys>. */
function oddsScopeQuery(books?: readonly string[]): string {
  const bm = bookmakersQueryParam(books ?? []);
  if (bm) return `bookmakers=${encodeURIComponent(bm)}`;
  return `regions=${VERIFY_REGIONS}`;
}

export type OddsUsagePurpose = "board" | "verify" | "results" | "clv";

let lastOddsApiRemaining: number | null = null;

/** Last `x-requests-remaining` observed from an Odds API response. */
export function getLastOddsApiRemaining(): number | null {
  return lastOddsApiRemaining;
}

/** Log Odds API credit usage from a response so burn is observable vs. the plan cap. */
export function logOddsUsage(
  res: Response,
  label: string,
  purpose: OddsUsagePurpose = "board",
  sport?: string,
): void {
  const remainingHeader = res.headers.get("x-requests-remaining");
  const last = res.headers.get("x-requests-last");
  if (remainingHeader !== null) {
    const parsed = Number(remainingHeader);
    if (!Number.isNaN(parsed)) lastOddsApiRemaining = parsed;
  }
  const cost = last != null ? Number(last) : 0;
  const remaining =
    remainingHeader != null ? Number(remainingHeader) : undefined;
  if (remainingHeader !== null || last !== null) {
    console.info(
      `[odds] purpose=${purpose} ${label}: cost=${last ?? "?"} remaining=${remainingHeader ?? "?"}`,
    );
  }
  void persistOddsUsageDaily({
    purpose,
    sport: sport ?? null,
    cost: Number.isFinite(cost) ? cost : 0,
    remaining:
      remaining != null && Number.isFinite(remaining) ? remaining : null,
  }).catch(() => {});
}

async function persistOddsUsageDaily(opts: {
  purpose: OddsUsagePurpose;
  sport: string | null;
  cost: number;
  remaining: number | null;
}): Promise<void> {
  const { hasOddsUsageDailyTable } =
    await import("@/lib/results/schema-features");
  if (!(await hasOddsUsageDailyTable())) return;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const sportKey = opts.sport ?? "";
  await prisma.oddsUsageDaily.upsert({
    where: {
      date_purpose_sport: {
        date: today,
        purpose: opts.purpose,
        sport: sportKey,
      },
    },
    create: {
      date: today,
      purpose: opts.purpose,
      sport: sportKey,
      calls: 1,
      credits: opts.cost,
      remaining: opts.remaining,
    },
    update: {
      calls: { increment: 1 },
      credits: { increment: opts.cost },
      remaining: opts.remaining,
    },
  });
}

export type OddsBoardMeta = {
  sport: string;
  supported: boolean;
  eventCount: number;
  warning?: string;
};

/** Safe diagnostics for empty odds boards (no secrets). */
export function buildOddsBoardMeta(
  sport: string,
  eventCount: number,
  opts?: { configured?: boolean; circuitBreak?: boolean },
): OddsBoardMeta {
  const configured = opts?.configured ?? Boolean(oddsApiKey());
  const supported = oddsAssistSupported(sport);
  let warning: string | undefined;

  if (!configured) {
    warning = "no_api_key";
  } else if (!supported) {
    warning = "unsupported_sport";
  } else if (opts?.circuitBreak) {
    warning = "circuit_break";
  } else if (eventCount === 0) {
    warning = "no_upcoming_events";
  }

  return { sport, supported, eventCount, warning };
}

const SOCCER_FETCH_PARALLEL = 3;
/** Soccer board cache window (seconds) — see the note at the fetch site. */
const SOCCER_BOARD_TTL = 600;

/**
 * Which soccer competitions are in season right now, from the Odds API catalog.
 *
 * `/v4/sports` costs ZERO credits and returns only in-season competitions, so
 * this is a free correction to a list that would otherwise be wrong for months
 * of every year. Cached for an hour — seasons don't turn over faster than that.
 * Returns null on any failure so the caller falls back to the static registry
 * rather than emptying the board.
 */
export async function fetchInSeasonSoccerLeagues(): Promise<
  SoccerLeague[] | null
> {
  const apiKey = oddsApiKey();
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/?apiKey=${apiKey}`,
      { next: { revalidate: 3600, tags: ["odds-sports-catalog"] } },
    );
    // Deliberately not logged as usage: the catalog endpoint is not billed.
    if (!res.ok) {
      console.warn(`[odds] sports catalog: HTTP ${res.status}`);
      return null;
    }
    const rows = (await res.json()) as OddsApiSportRow[];
    if (!Array.isArray(rows)) return null;
    const leagues = selectSoccerLeagues(rows);
    return leagues.length ? leagues : null;
  } catch (err) {
    console.warn("[odds] sports catalog fetch failed", err);
    return null;
  }
}

/** Soccer board — fans out across SOCCER_LEAGUES with capped parallelism. */
export async function fetchSoccerBoard(
  opts?: OddsBoardOpts,
): Promise<OddsEvent[]> {
  const apiKey = oddsApiKey();
  if (!apiKey) return [];

  if (shouldCircuitBreak(lastOddsApiRemaining)) {
    console.warn(
      `[odds] circuit-breaker active (remaining=${lastOddsApiRemaining}) — skipping soccer board`,
    );
    return [];
  }

  const preferred = opts?.books;
  const fetchLeague = async (oddsApiKey: string, leagueKey: string) => {
    const attempt = async (books: readonly string[] | undefined) => {
      const url =
        `https://api.the-odds-api.com/v4/sports/${oddsApiKey}/odds/` +
        `?apiKey=${apiKey}&${oddsScopeQuery(books)}&markets=h2h,spreads,totals&oddsFormat=american`;
      // Soccer is the one sport that fans out over many competitions, so its
      // board is by far the most expensive to refresh. Selecting only in-season
      // competitions means every one of these calls now returns fixtures and is
      // therefore billed, where most used to be free no-ops — so the refresh
      // window widens to keep the monthly burn flat. Browsing tolerates a
      // slightly older price: the number that actually goes on the record is
      // re-fetched per event at submit time.
      const res = await fetch(url, { next: { revalidate: SOCCER_BOARD_TTL } });
      logOddsUsage(res, `soccer ${leagueKey}`, "board", "SOCCER");
      if (!res.ok) {
        console.warn(`[odds] soccer ${leagueKey}: HTTP ${res.status}`);
        return [] as OddsEvent[];
      }
      const events = (await res.json()) as Parameters<
        typeof normalizeUpcomingEvent
      >[1][];
      return events
        .map((e) => normalizeUpcomingEvent("SOCCER", e, preferred, leagueKey))
        .filter((e) => e.selections.length > 0);
    };

    const board = await attempt(preferred);
    if (board.length > 0) return board;
    if (bookmakersQueryParam(preferred ?? [])) {
      return await attempt(undefined);
    }
    return board;
  };

  // Ask the catalog what is actually in season before spending credits. Falling
  // back to the full registry keeps the old behaviour when the catalog is
  // unreachable — degraded, never empty by construction.
  const leagues =
    (await fetchInSeasonSoccerLeagues()) ??
    SOCCER_LEAGUES.slice(0, SOCCER_LEAGUE_LIMIT);

  const all: OddsEvent[] = [];
  try {
    for (let i = 0; i < leagues.length; i += SOCCER_FETCH_PARALLEL) {
      const batch = leagues.slice(i, i + SOCCER_FETCH_PARALLEL);
      const chunk = await Promise.all(
        batch.map((l) => fetchLeague(l.oddsApiKey, l.key)),
      );
      all.push(...chunk.flat());
    }
    if (all.length === 0) {
      console.info(
        `[odds] soccer: 0 events across ${leagues.length} in-season competitions` +
          ` (${leagues.map((l) => l.key).join(", ")})`,
      );
    }
    return dedupeOddsEvents(all).slice(0, 80);
  } catch (err) {
    console.warn("[odds] soccer board fetch failed", err);
    return [];
  }
}

/** Upcoming games with moneyline + totals for a SCL sport. [] when no key/unsupported. */
export async function fetchUpcomingOdds(
  sclSport: string,
  opts?: OddsBoardOpts,
): Promise<OddsEvent[]> {
  if (sclSport === "SOCCER") return fetchSoccerBoard(opts);

  const apiKey = oddsApiKey();
  const apiSport = toOddsApiSport(sclSport);
  if (!apiKey || !apiSport) return [];

  if (shouldCircuitBreak(lastOddsApiRemaining)) {
    console.warn(
      `[odds] circuit-breaker active (remaining=${lastOddsApiRemaining}) — skipping uncached board fetch for ${sclSport}`,
    );
    return [];
  }

  const preferred = opts?.books;
  const attempt = async (books: readonly string[] | undefined) => {
    const url =
      `https://api.the-odds-api.com/v4/sports/${apiSport}/odds/` +
      `?apiKey=${apiKey}&${oddsScopeQuery(books)}&markets=h2h,spreads,totals&oddsFormat=american`;
    const res = await fetch(url, { next: { revalidate: 120 } });
    logOddsUsage(res, `upcoming ${sclSport}`, "board", sclSport);
    if (!res.ok) {
      console.warn(`[odds] upcoming ${sclSport}: HTTP ${res.status}`);
      return [] as OddsEvent[];
    }
    const events = (await res.json()) as Parameters<
      typeof normalizeUpcomingEvent
    >[1][];
    return dedupeOddsEvents(
      events
        .map((e) => normalizeUpcomingEvent(sclSport, e, preferred))
        .filter((e) => e.selections.length > 0),
    ).slice(0, 60);
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
  opts?: OddsBoardOpts & { purpose?: OddsUsagePurpose; league?: string | null },
): Promise<RawEventOdds | null> {
  const apiKey = oddsApiKey();
  const apiSport = resolveOddsApiSport(sclSport, opts?.league);
  if (!apiKey || !apiSport) return null;
  const markets = verificationMarkets(sclSport).join(",");
  const purpose = opts?.purpose ?? "verify";

  const attempt = async (books: readonly string[] | undefined) => {
    const url =
      `https://api.the-odds-api.com/v4/sports/${apiSport}/events/${eventId}/odds/` +
      `?apiKey=${apiKey}&${oddsScopeQuery(books)}&markets=${markets}&oddsFormat=american`;
    const res = await fetch(url, {
      next: { revalidate: VERIFY_TTL_SECONDS, tags: [`odds-event:${eventId}`] },
    });
    logOddsUsage(res, `event ${eventId}`, purpose, sclSport);
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
 * Re-fetch event odds and return the live American for one board line (M5 guard).
 * `event` is null when the fetch failed; `liveAmerican` is null when the line is
 * suspended/unavailable on the requested book scope.
 */
export async function fetchLiveLine(params: {
  sclSport: string;
  eventId: string;
  marketKeys: string[];
  side: string;
  line?: number;
  player?: string;
  book?: string | null;
  books?: readonly string[];
}): Promise<{ event: RawEventOdds | null; liveAmerican: number | null }> {
  const event = await fetchEventOddsForVerification(
    params.sclSport,
    params.eventId,
    { books: params.books },
  );
  if (!event) return { event: null, liveAmerican: null };
  const bookKeys = (params.books ?? []).filter(isBookKey);
  const book = params.book && isBookKey(params.book) ? params.book : null;
  const liveAmerican = liveLineAmerican(event, {
    marketKeys: params.marketKeys,
    side: params.side,
    line: params.line,
    player: params.player,
    bookKey: book,
    bookKeys,
  });
  return { event, liveAmerican };
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
