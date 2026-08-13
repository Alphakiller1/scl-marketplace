import "server-only";

import { afterResponse } from "@/lib/after-response";
import { bookmakersQueryParam, isBookKey } from "@/lib/books";
import { shouldCircuitBreak } from "@/lib/odds-budget";
import {
  isOddsKeyExhausted,
  markOddsKeyExhausted,
  nextOddsApiKey,
  parseOddsApiKeys,
  resetOddsKeyRotation,
} from "@/lib/odds-keys";
import {
  SOCCER_LEAGUES,
  SOCCER_LEAGUE_LIMIT,
  selectSoccerLeagues,
  soccerLeagueByKey,
  type OddsApiSportRow,
  type SoccerLeague,
} from "@/lib/soccer-leagues";
import {
  TENNIS_TOUR_LIMIT,
  selectTennisTours,
  tennisTourByKey,
  type TennisTour,
} from "@/lib/tennis-tours";
import { prisma } from "@/lib/prisma";
import {
  dedupeOddsEvents,
  normalizeEventBoard,
  normalizeUpcomingEvent,
  sortByKickoff,
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

/**
 * Extra Odds API keys that belong to the same SCL sport.
 *
 * The Odds API files preseason under its OWN sport key, so a board that asks
 * only for `americanfootball_nfl` shows nothing all August — the games exist,
 * they are simply filed elsewhere. These are fetched alongside the primary key
 * and merged into one slate.
 */
const ODDS_API_EXTRA_SPORTS: Record<string, string[]> = {
  NFL: ["americanfootball_nfl_preseason"],
  NBA: ["basketball_nba_preseason"],
};

/** League tag carried on an event so verification can find its own sport key. */
export function extraSportLeagueTag(oddsApiSport: string): string {
  return oddsApiSport.toUpperCase();
}

const EXTRA_SPORT_BY_TAG: Record<string, string> = Object.fromEntries(
  Object.values(ODDS_API_EXTRA_SPORTS)
    .flat()
    .map((key) => [extraSportLeagueTag(key), key]),
);

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
  // Tennis, like soccer, has no single sport key — one key per tournament, and
  // a tournament lasts about a week. The league tag carried on the event is the
  // only way back to the key once the tour has moved on.
  if (sclSport === "TENNIS") {
    if (!league) return undefined;
    return tennisTourByKey(league)?.oddsApiKey;
  }
  // A preseason pick must verify against the preseason key it came from, not
  // the regular-season one, or its event is simply absent.
  const extra = league ? EXTRA_SPORT_BY_TAG[league.toUpperCase()] : undefined;
  if (extra) return extra;
  return toOddsApiSport(sclSport);
}

/**
 * The Odds API key to spend next.
 *
 * Rotation lives in `odds-keys.ts` — see there for why an exhausted key is a
 * silent failure rather than a loud one.
 */
export function oddsApiKey(): string | undefined {
  return nextOddsApiKey();
}

export { parseOddsApiKeys as oddsApiKeys, resetOddsKeyRotation };

export function toSclSport(oddsApiKey: string): string | undefined {
  return ODDS_API_TO_SCL[oddsApiKey];
}

/** Sports we can odds-assist / auto-grade as game moneyline + totals. */
export function oddsAssistSupported(sclKey: string): boolean {
  return (
    sclKey in SCL_TO_ODDS_API || sclKey === "SOCCER" || sclKey === "TENNIS"
  );
}

/** regions=us when books empty; else bookmakers=<keys>. */
function oddsScopeQuery(books?: readonly string[]): string {
  const bm = bookmakersQueryParam(books ?? []);
  if (bm) return `bookmakers=${encodeURIComponent(bm)}`;
  return `regions=${VERIFY_REGIONS}`;
}

export type OddsUsagePurpose = "board" | "verify" | "results" | "clv";

let lastOddsApiRemaining: number | null = null;
let lastOddsApiCapacity: number | null = null;

/** Last `x-requests-remaining` observed from an Odds API response. */
export function getLastOddsApiRemaining(): number | null {
  return lastOddsApiRemaining;
}

/**
 * The plan size of the key in use, as `remaining + used` from the last response.
 *
 * The Odds API never states the plan directly, but it returns both halves of it
 * on every response, so the cap is observable without configuring it. The
 * circuit-breaker reserve is scaled from this — see `circuitBreakThreshold`.
 */
export function getLastOddsApiCapacity(): number | null {
  return lastOddsApiCapacity;
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
  const usedHeader = res.headers.get("x-requests-used");
  if (remainingHeader !== null) {
    const parsed = Number(remainingHeader);
    if (!Number.isNaN(parsed)) lastOddsApiRemaining = parsed;
  }
  // remaining + used is the plan cap, which nothing else reports.
  if (remainingHeader !== null && usedHeader !== null) {
    const rem = Number(remainingHeader);
    const used = Number(usedHeader);
    if (!Number.isNaN(rem) && !Number.isNaN(used) && rem + used > 0) {
      lastOddsApiCapacity = rem + used;
    }
  }
  const cost = last != null ? Number(last) : 0;
  const remaining =
    remainingHeader != null ? Number(remainingHeader) : undefined;
  if (remainingHeader !== null || last !== null) {
    console.info(
      `[odds] purpose=${purpose} ${label}: cost=${last ?? "?"} remaining=${remainingHeader ?? "?"}`,
    );
  }
  // Scheduled, not fired-and-forgotten: an unawaited write here was being cut
  // off mid-transaction when the isolate froze, wedging a pooled connection
  // `idle in transaction` until it timed out. Telemetry must never cost the app
  // a connection.
  afterResponse(() =>
    persistOddsUsageDaily({
      purpose,
      sport: sport ?? null,
      cost: Number.isFinite(cost) ? cost : 0,
      remaining:
        remaining != null && Number.isFinite(remaining) ? remaining : null,
    }),
  );
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

/**
 * A billed Odds API request, retried down the key chain when a key is refused.
 *
 * The Odds API answers an exhausted or revoked key with 401/429 and no usage
 * headers, which is indistinguishable at the call site from "no lines today" —
 * every board fetch here swallows a non-OK response and returns an empty slate.
 * That is how a dead key reads as an empty site rather than an outage. Rotating
 * here means one refused key costs a retry, not the board.
 *
 * `buildUrl` takes the key so the caller keeps ownership of its query string;
 * the returned Response is whatever the first accepting key gave, or the last
 * refusal when every key is spent.
 */
async function oddsApiFetch(
  buildUrl: (apiKey: string) => string,
  init: Parameters<typeof fetch>[1],
  log: { label: string; purpose: OddsUsagePurpose; sport?: string },
): Promise<Response | null> {
  let lastRefusal: Response | null = null;

  for (const key of parseOddsApiKeys()) {
    if (isOddsKeyExhausted(key)) continue;

    const res = await fetch(buildUrl(key), init);
    logOddsUsage(res, log.label, log.purpose, log.sport);

    if (res.status === 401 || res.status === 429) {
      markOddsKeyExhausted(key, `HTTP ${res.status}`);
      lastRefusal = res;
      continue;
    }

    // Read this response's own header rather than the module-level total: a
    // refusal carries no usage headers, so the stale value from the previous
    // key would otherwise condemn the key that just succeeded.
    const remaining = Number(res.headers.get("x-requests-remaining"));
    if (Number.isFinite(remaining) && remaining <= 0) {
      markOddsKeyExhausted(key, "0 credits remaining");
    }
    return res;
  }

  return lastRefusal;
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

/**
 * Board refreshes allowed per sport per day.
 *
 * The board is budgeted in refreshes rather than freshness because the plan is
 * small and the spend has to be predictable: one refresh costs 3 credits per
 * sport key, and the cache window is simply the day divided by this number. MLB
 * and WNBA carry the picks cappers actually log, so they get a second look —
 * enough to pick up a starter scratch or a line move before first pitch. The
 * rest are posted once and left alone.
 *
 * This bounds BROWSING only. The price written onto a pick is never taken from
 * this cache: submission re-fetches the event live and bounds the claim against
 * it, so a stale board costs a capper nothing but a slightly old-looking number.
 */
const BOARD_REFRESHES_PER_DAY: Record<string, number> = {
  MLB: 2,
  WNBA: 2,
};

const DEFAULT_BOARD_REFRESHES_PER_DAY = 1;
const SECONDS_PER_DAY = 86_400;

/** Board cache window (seconds) for a sport — the day split by its refresh budget. */
export function boardTtlForSport(sclSport: string): number {
  const perDay =
    BOARD_REFRESHES_PER_DAY[sclSport.trim().toUpperCase()] ??
    DEFAULT_BOARD_REFRESHES_PER_DAY;
  return Math.floor(SECONDS_PER_DAY / Math.max(1, perDay));
}

/**
 * Which soccer competitions are in season right now, from the Odds API catalog.
 *
 * `/v4/sports` costs ZERO credits and returns only in-season competitions, so
 * this is a free correction to a list that would otherwise be wrong for months
 * of every year. Cached for an hour — seasons don't turn over faster than that.
 * Returns null on any failure so the caller falls back to the static registry
 * rather than emptying the board.
 */
async function fetchSportsCatalog(): Promise<OddsApiSportRow[] | null> {
  if (!oddsApiKey()) return null;
  try {
    const res = await oddsApiFetch(
      (apiKey) => `https://api.the-odds-api.com/v4/sports/?apiKey=${apiKey}`,
      { next: { revalidate: 3600, tags: ["odds-sports-catalog"] } },
      // Deliberately labelled but not billed: the catalog endpoint is free, so
      // it reports cost=0 and only serves to surface key rotation in the log.
      { label: "sports catalog", purpose: "board" },
    );
    if (!res?.ok) {
      console.warn(
        `[odds] sports catalog: HTTP ${res?.status ?? "no-response"}`,
      );
      return null;
    }
    const rows = (await res.json()) as OddsApiSportRow[];
    return Array.isArray(rows) ? rows : null;
  } catch (err) {
    console.warn("[odds] sports catalog fetch failed", err);
    return null;
  }
}

export async function fetchInSeasonSoccerLeagues(): Promise<
  SoccerLeague[] | null
> {
  const rows = await fetchSportsCatalog();
  if (!rows) return null;
  const leagues = selectSoccerLeagues(rows);
  return leagues.length ? leagues : null;
}

/**
 * Which tennis tournaments are on right now, from the same free catalog.
 *
 * Returns null rather than an empty list on failure so the caller can tell
 * "could not ask" from "the tour is genuinely dark this week" — there is no
 * static fallback to degrade to, because a tennis registry is stale in days.
 */
export async function fetchInSeasonTennisTours(): Promise<TennisTour[] | null> {
  const rows = await fetchSportsCatalog();
  if (!rows) return null;
  return selectTennisTours(rows, TENNIS_TOUR_LIMIT);
}

/** Soccer board — fans out across SOCCER_LEAGUES with capped parallelism. */
export async function fetchSoccerBoard(
  opts?: OddsBoardOpts,
): Promise<OddsEvent[]> {
  if (!oddsApiKey()) return [];

  if (shouldCircuitBreak(lastOddsApiRemaining, lastOddsApiCapacity)) {
    console.warn(
      `[odds] circuit-breaker active (remaining=${lastOddsApiRemaining}) — skipping soccer board`,
    );
    return [];
  }

  const preferred = opts?.books;
  const fetchLeague = async (leagueApiSport: string, leagueKey: string) => {
    const attempt = async (books: readonly string[] | undefined) => {
      // Soccer is the one sport that fans out over many competitions, so its
      // board is by far the most expensive to refresh. Selecting only in-season
      // competitions means every one of these calls now returns fixtures and is
      // therefore billed, where most used to be free no-ops — so the refresh
      // window widens to keep the monthly burn flat. Browsing tolerates a
      // slightly older price: the number that actually goes on the record is
      // re-fetched per event at submit time.
      const res = await oddsApiFetch(
        (apiKey) =>
          `https://api.the-odds-api.com/v4/sports/${leagueApiSport}/odds/` +
          `?apiKey=${apiKey}&${oddsScopeQuery(books)}&markets=h2h,spreads,totals&oddsFormat=american`,
        { next: { revalidate: boardTtlForSport("SOCCER") } },
        { label: `soccer ${leagueKey}`, purpose: "board", sport: "SOCCER" },
      );
      if (!res?.ok) {
        console.warn(
          `[odds] soccer ${leagueKey}: HTTP ${res?.status ?? "no-response"}`,
        );
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

/**
 * Tennis board — fans out across the tournaments currently on tour.
 *
 * Same shape as soccer, with one difference that matters: there is no static
 * registry to fall back on. If the catalog cannot be reached the board is empty
 * rather than wrong, because guessing which tournament is on this week would be
 * guessing at a key that stopped existing days ago.
 */
export async function fetchTennisBoard(
  opts?: OddsBoardOpts,
): Promise<OddsEvent[]> {
  if (!oddsApiKey()) return [];

  if (shouldCircuitBreak(lastOddsApiRemaining, lastOddsApiCapacity)) {
    console.warn(
      `[odds] circuit-breaker active (remaining=${lastOddsApiRemaining}) — skipping tennis board`,
    );
    return [];
  }

  const tours = await fetchInSeasonTennisTours();
  if (!tours?.length) {
    console.info("[odds] tennis: no in-season tournaments in the catalog");
    return [];
  }

  const preferred = opts?.books;
  const fetchTour = async (tour: TennisTour) => {
    const attempt = async (books: readonly string[] | undefined) => {
      const res = await oddsApiFetch(
        (apiKey) =>
          `https://api.the-odds-api.com/v4/sports/${tour.oddsApiKey}/odds/` +
          `?apiKey=${apiKey}&${oddsScopeQuery(books)}&markets=h2h,spreads,totals&oddsFormat=american`,
        { next: { revalidate: boardTtlForSport("TENNIS") } },
        { label: `tennis ${tour.key}`, purpose: "board", sport: "TENNIS" },
      );
      if (!res?.ok) {
        console.warn(
          `[odds] tennis ${tour.key}: HTTP ${res?.status ?? "no-response"}`,
        );
        return [] as OddsEvent[];
      }
      const events = (await res.json()) as Parameters<
        typeof normalizeUpcomingEvent
      >[1][];
      // A match already under way carries no bookmakers; `selections.length`
      // drops it, which is also what keeps completed qualifying off the board.
      return events
        .map((e) => normalizeUpcomingEvent("TENNIS", e, preferred, tour.key))
        .filter((e) => e.selections.length > 0);
    };

    const board = await attempt(preferred);
    if (board.length > 0) return board;
    if (bookmakersQueryParam(preferred ?? [])) {
      return await attempt(undefined);
    }
    return board;
  };

  try {
    const chunks = await Promise.all(tours.map(fetchTour));
    const all = chunks.flat();
    if (all.length === 0) {
      console.info(
        `[odds] tennis: 0 events across ${tours.length} tournaments` +
          ` (${tours.map((t) => t.key).join(", ")})`,
      );
    }
    return sortByKickoff(dedupeOddsEvents(all)).slice(0, 80);
  } catch (err) {
    console.warn("[odds] tennis board fetch failed", err);
    return [];
  }
}

/**
 * Boards for a sport's extra Odds API keys — today, preseason.
 *
 * Each event is tagged with the key it came from so a pick logged against it
 * verifies against that same key. Failures are swallowed per key: a missing
 * preseason board must never empty the regular-season one.
 */
async function fetchExtraSportBoards(
  sclSport: string,
  preferred: readonly string[] | undefined,
): Promise<OddsEvent[]> {
  const extras = ODDS_API_EXTRA_SPORTS[sclSport] ?? [];
  if (!oddsApiKey() || extras.length === 0) return [];

  const boards = await Promise.all(
    extras.map(async (apiSport) => {
      try {
        const res = await oddsApiFetch(
          (apiKey) =>
            `https://api.the-odds-api.com/v4/sports/${apiSport}/odds/` +
            `?apiKey=${apiKey}&${oddsScopeQuery(preferred)}&markets=h2h,spreads,totals&oddsFormat=american`,
          { next: { revalidate: boardTtlForSport(sclSport) } },
          { label: `upcoming ${apiSport}`, purpose: "board", sport: sclSport },
        );
        if (!res?.ok) return [] as OddsEvent[];
        const events = (await res.json()) as Parameters<
          typeof normalizeUpcomingEvent
        >[1][];
        return events
          .map((e) =>
            normalizeUpcomingEvent(
              sclSport,
              e,
              preferred,
              extraSportLeagueTag(apiSport),
            ),
          )
          .filter((e) => e.selections.length > 0);
      } catch {
        return [] as OddsEvent[];
      }
    }),
  );
  return boards.flat();
}

/** Upcoming games with moneyline + totals for a SCL sport. [] when no key/unsupported. */
export async function fetchUpcomingOdds(
  sclSport: string,
  opts?: OddsBoardOpts,
): Promise<OddsEvent[]> {
  if (sclSport === "SOCCER") return fetchSoccerBoard(opts);
  if (sclSport === "TENNIS") return fetchTennisBoard(opts);

  const apiSport = toOddsApiSport(sclSport);
  if (!oddsApiKey() || !apiSport) return [];

  if (shouldCircuitBreak(lastOddsApiRemaining, lastOddsApiCapacity)) {
    console.warn(
      `[odds] circuit-breaker active (remaining=${lastOddsApiRemaining}) — skipping uncached board fetch for ${sclSport}`,
    );
    return [];
  }

  const preferred = opts?.books;
  const attempt = async (books: readonly string[] | undefined) => {
    // The pick entry page fans out across every board sport on mount, so this
    // window sets how often a browsing session bills the Odds API — see
    // `BOARD_REFRESHES_PER_DAY`, which budgets it in refreshes per day rather
    // than in seconds. Browsing tolerates a slightly older price: the number
    // that actually goes on the record is re-fetched per event at submit time
    // and bounded against the live market there.
    const res = await oddsApiFetch(
      (apiKey) =>
        `https://api.the-odds-api.com/v4/sports/${apiSport}/odds/` +
        `?apiKey=${apiKey}&${oddsScopeQuery(books)}&markets=h2h,spreads,totals&oddsFormat=american`,
      { next: { revalidate: boardTtlForSport(sclSport) } },
      { label: `upcoming ${sclSport}`, purpose: "board", sport: sclSport },
    );
    if (!res?.ok) {
      console.warn(
        `[odds] upcoming ${sclSport}: HTTP ${res?.status ?? "no-response"}`,
      );
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
    // Preseason lives under its own sport key, so it is fetched alongside and
    // merged rather than replacing anything: during the crossover weeks both
    // slates are genuinely live.
    const extras = await fetchExtraSportBoards(sclSport, preferred);
    if (board.length > 0 || extras.length > 0) {
      // Sort before the cap, or the cap silently decides the slate.
      // `attempt` already returned 60 regular-season events — books post the
      // whole season in August — so appending preseason and slicing to 60 threw
      // every preseason game away after paying to fetch it. Ordering by kickoff
      // means the soonest games win the 60 slots, which is what the board is
      // for: in August that is preseason, in September the regular season
      // reclaims them on its own.
      return sortByKickoff(dedupeOddsEvents([...board, ...extras])).slice(
        0,
        60,
      );
    }

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
  opts?: OddsBoardOpts & {
    purpose?: OddsUsagePurpose;
    league?: string | null;
    /**
     * Request only these market keys instead of the full bundle.
     *
     * The Odds API bills per market per region, so the bundle that makes
     * browsing cheap (one cached call serving the board AND the submit-time
     * check) is pure waste for a caller that reads a single market. Closing-odds
     * snapshots run on cron against events nobody is browsing and use exactly
     * one market, so they were paying ~20x their cost to fill a cache entry
     * nothing else would read.
     */
    markets?: readonly string[];
  },
): Promise<RawEventOdds | null> {
  const apiSport = resolveOddsApiSport(sclSport, opts?.league);
  if (!oddsApiKey() || !apiSport) return null;
  const requested = opts?.markets?.length
    ? [...new Set(opts.markets)]
    : verificationMarkets(sclSport);
  const markets = requested.join(",");
  const purpose = opts?.purpose ?? "verify";

  const attempt = async (books: readonly string[] | undefined) => {
    const res = await oddsApiFetch(
      (apiKey) =>
        `https://api.the-odds-api.com/v4/sports/${apiSport}/events/${eventId}/odds/` +
        `?apiKey=${apiKey}&${oddsScopeQuery(books)}&markets=${markets}&oddsFormat=american`,
      {
        next: {
          revalidate: VERIFY_TTL_SECONDS,
          tags: [`odds-event:${eventId}`],
        },
      },
      { label: `event ${eventId}`, purpose, sport: sclSport },
    );
    // A rejected per-event request used to be indistinguishable from "no lines":
    // both returned null with nothing logged.
    if (!res?.ok) {
      console.warn(
        `[odds] event ${eventId} (${sclSport}): HTTP ${res?.status ?? "no-response"}`,
      );
      return null;
    }
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
