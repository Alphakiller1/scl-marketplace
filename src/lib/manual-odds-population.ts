import type { OddsEvent } from "@/lib/odds-board";
import { expandedBoardMarkets } from "@/lib/odds-verify";

/**
 * Owner priority for sports with per-event expanded boards.
 *
 * MLB first and soccer last is a budget decision, not a taste one: a full MLB
 * card at full markets costs more than a whole top-up key, so whatever runs
 * after it only gets what the reserve held back. Soccer's expanded call adds a
 * single market (Double Chance) across eighty fixtures, so it is the one that
 * can be cut to a partial slate without leaving a game unbettable.
 */
export const DEFAULT_EXPANDED_SPORT_ORDER = [
  "MLB",
  "WNBA",
  "TENNIS",
  "SOCCER",
] as const;

export type ExpandedSlateDay = "today" | "tomorrow";

const ET_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function etDay(date: Date): string {
  return ET_DAY.format(date);
}

export function parseExpandedSlateDays(value: string): ExpandedSlateDay[] {
  const days = value
    .split(",")
    .map((day) => day.trim().toLowerCase())
    .filter(
      (day): day is ExpandedSlateDay => day === "today" || day === "tomorrow",
    );
  return [...new Set(days)];
}

/**
 * Sports whose expanded board covers EVERY fixture on the board.
 *
 * The ET slate-day filter is a budget control, and it is the right one when an
 * expanded board costs twenty-odd credits a game: MLB pays for alternate
 * ladders, team totals, F3/F5/F7 and four prop markets, so paying that for a
 * fixture four days out would spend the month on games nobody is pricing yet.
 *
 * Soccer is the opposite shape. Its expanded call is ONE market — Double
 * Chance, which the bulk endpoint does not serve — so a fixture costs a single
 * credit. Capping it to "today" therefore saved almost nothing and cost the
 * market entirely: the soccer board carries six days of fixtures, so 46 of 49
 * had no Double Chance at all and cappers saw it appear on a handful of games
 * and vanish on the rest. Covering the whole board is ~49 credits against a
 * five-figure balance.
 *
 * The rule is the cost shape, not the sport: a sport belongs here when one
 * expanded board is cheap enough that the slate-day filter buys nothing.
 */
export const FULL_SLATE_EXPANDED_SPORTS = new Set(["SOCCER"]);

/** True when every future fixture on the board should be expanded. */
export function expandsFullSlate(sport: string): boolean {
  return FULL_SLATE_EXPANDED_SPORTS.has(sport.trim().toUpperCase());
}

/** Select only the ET slate days that should receive metered event markets. */
export function selectExpandedSlateEvents(
  events: readonly OddsEvent[],
  days: readonly ExpandedSlateDay[],
  now = new Date(),
  sport?: string,
): OddsEvent[] {
  const future = events.filter(
    (event) => Date.parse(event.commenceTime) > now.getTime(),
  );
  // A cheap expanded board follows the board, not the slate day.
  if (sport && expandsFullSlate(sport)) return future;

  const allowed = new Set<string>();
  if (days.includes("today")) allowed.add(etDay(now));
  if (days.includes("tomorrow")) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    allowed.add(etDay(tomorrow));
  }
  return future.filter((event) =>
    allowed.has(etDay(new Date(event.commenceTime))),
  );
}

/**
 * Merge a successful surface response over the durable board.
 *
 * The provider can omit one future fixture from an otherwise successful
 * response. Retaining prior future events makes the manual writer follow the
 * same last-known-good contract as the live cache path.
 */
export function mergeLastGoodBoardEvents(
  fresh: readonly OddsEvent[],
  prior: readonly OddsEvent[],
  now = new Date(),
): OddsEvent[] {
  const freshIds = new Set(fresh.map((event) => event.id));
  return [
    ...fresh,
    ...prior.filter(
      (event) =>
        !freshIds.has(event.id) &&
        Date.parse(event.commenceTime) > now.getTime() &&
        event.selections.length > 0,
    ),
  ].sort((a, b) => Date.parse(a.commenceTime) - Date.parse(b.commenceTime));
}

/** Markets × one region — the billed cost of one expanded event board. */
export function expandedEventCreditCost(sport: string): number {
  return expandedBoardMarkets(sport).length;
}

/**
 * The Odds API bills one credit for `/events/{id}/markets`, which lists exactly
 * which market keys the covered books are pricing for that fixture.
 */
export const EVENT_MARKET_CATALOG_CREDIT_COST = 1;

/**
 * Request lists at or below this length are cheaper to just ask for.
 *
 * Reading the catalog costs one credit and saves one per market no book is
 * pricing, so it pays off only when the request list is long enough that some
 * of it is likely to come back empty. MLB asks for 58 markets and WNBA 36 —
 * there the catalog is the difference between finishing the slate and running
 * out partway through it. Tennis asks for four and soccer for one: paying a
 * credit to learn which of four to skip can cost more than the four, and on a
 * single-market request it always does.
 *
 * Eight is a deliberate margin above tennis's four rather than a tuned number;
 * what matters is that the two expensive sports are on the catalog path and the
 * two cheap ones are not.
 */
export const CATALOG_WORTH_READING_MARKETS = 8;

/**
 * Market keys any covered book is actually pricing for one event.
 *
 * The odds endpoint bills `markets × regions` whether or not a market comes
 * back with anything, so a fixed request list pays for every key no book posts
 * — on a full MLB card that is the difference between finishing the slate and
 * running out of credits partway through it. Reading the catalog first costs
 * one credit and removes the rest.
 */
export function eventMarketCatalogKeys(payload: unknown): string[] {
  const bookmakers = (payload as { bookmakers?: unknown })?.bookmakers;
  if (!Array.isArray(bookmakers)) return [];
  const keys = new Set<string>();
  for (const bookmaker of bookmakers) {
    const markets = (bookmaker as { markets?: unknown })?.markets;
    if (!Array.isArray(markets)) continue;
    for (const market of markets) {
      const key = (market as { key?: unknown })?.key;
      if (typeof key === "string" && key.trim()) keys.add(key.trim());
    }
  }
  return [...keys];
}

/**
 * The markets worth paying for on this event: what we want, minus what nobody
 * is pricing. Order follows the request list so the board keeps its shape.
 *
 * An empty catalog means the lookup failed, not that the fixture has no
 * markets — falling back to the full request list there keeps a catalog outage
 * from silently emptying the board.
 */
export function intersectExpandedMarkets(
  desired: readonly string[],
  available: readonly string[],
): string[] {
  if (available.length === 0) return [...desired];
  const offered = new Set(available);
  return desired.filter((market) => offered.has(market));
}

/**
 * Parse `expandedOrder=MLB,WNBA,TENNIS`. Unknown sports are dropped; requested
 * expanded sports missing from the list are appended in default order.
 */
export function parseExpandedSportOrder(
  value: string | null | undefined,
  requestedSports: readonly string[],
): string[] {
  const wanted = new Set(
    requestedSports
      .map((sport) => sport.trim().toUpperCase())
      .filter((sport) =>
        (DEFAULT_EXPANDED_SPORT_ORDER as readonly string[]).includes(sport),
      ),
  );
  const listed = (value ?? "")
    .split(",")
    .map((sport) => sport.trim().toUpperCase())
    .filter((sport) => wanted.has(sport));
  const ordered = [...new Set(listed)];
  for (const sport of DEFAULT_EXPANDED_SPORT_ORDER) {
    if (wanted.has(sport) && !ordered.includes(sport)) ordered.push(sport);
  }
  return ordered;
}

/**
 * How old an expanded event board may be before a scheduled populate pays to
 * move it, in minutes.
 *
 * `ODDS_EVENT_FRESH_SECONDS` (10 minutes) is the browse window — the age at
 * which opening a matchup refetches one event. Reusing it here would refetch
 * every event on every run, since runs are hours apart, and a full MLB card is
 * the most expensive thing this route can do.
 *
 * Two hours sits below the gap between scheduled runs, so each run moves the
 * prices the run before it wrote, while a manual run fired minutes after
 * another does not re-bill the whole slate.
 */
export const DEFAULT_EXPANDED_MAX_AGE_MINUTES = 120;

export function parseExpandedMaxAgeMinutes(
  value: string | null | undefined,
): number {
  // Checked before `Number`, which reads null and "" as 0 — and 0 is the one
  // value that means "refetch every covered board". An absent parameter would
  // otherwise re-bill the whole slate on every scheduled run.
  const trimmed = value?.trim();
  if (!trimmed) return DEFAULT_EXPANDED_MAX_AGE_MINUTES;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_EXPANDED_MAX_AGE_MINUTES;
  }
  // A day is the ceiling: past that the slate has turned over anyway.
  return Math.min(24 * 60, Math.floor(parsed));
}

/**
 * May a populate skip this event, or does it owe it fresh prices?
 *
 * Coverage alone said skip, and "complete" is a permanent property — once a
 * board was filled it was skipped on every later run and its prop and alternate
 * prices never moved again. The 13:22 populate on 2026-08-26 refreshed all five
 * surface boards and skipped 13 of 15 MLB games as covered, 11 of them serving
 * expanded prices captured the previous evening. An intraday cadence cannot
 * reach the deep board while completeness alone decides.
 */
export function canSkipExpandedEvent(
  fullyCovered: boolean,
  savedAt: number | null,
  maxAgeMinutes: number,
  now: number = Date.now(),
): boolean {
  if (!fullyCovered) return false;
  if (savedAt == null) return false;
  return now - savedAt <= maxAgeMinutes * 60_000;
}

/** One sport's surface board as the populate route saw it. */
export type SurfaceOutcome = { source: string; stale: boolean };

/**
 * Did a populate that asked for fresh prices actually get any?
 *
 * `updateOddsBoardSegment` writes `provider` only when the provider answered
 * with events; every other source is last-good data replayed out of the cache.
 * Counting cached events as success is what hid a spent key for a full day —
 * five sports came back `stale_provider_failure`, the board froze on yesterday's
 * prices, and the scheduled job reported success on all five because the CACHE
 * still held events.
 *
 * A run that did not ask for a surface refresh (`surface=0`, the shape a
 * targeted expanded top-up uses) has nothing to judge and passes.
 */
export function surfaceRefreshReachedProvider(
  refreshSurface: boolean,
  surfaces: Readonly<Record<string, SurfaceOutcome>>,
): boolean {
  if (!refreshSurface) return true;
  return Object.values(surfaces).some((row) => row.source === "provider");
}

/** Sports serving a board older than the freshness window. */
export function staleSurfaceSports(
  surfaces: Readonly<Record<string, SurfaceOutcome>>,
): string[] {
  return Object.entries(surfaces)
    .filter(([, row]) => row.stale)
    .map(([sport]) => sport)
    .sort();
}

export function laterExpandedCreditReserve(
  later: readonly { sport: string; events: number }[],
): number {
  return later.reduce(
    (sum, row) => sum + row.events * expandedEventCreditCost(row.sport),
    0,
  );
}

/**
 * Stop the current expanded sport so later expanded boards (and the circuit
 * reserve) still fit. `remaining == null` means no provider response yet.
 */
export function shouldHoldCreditsForLater(
  remaining: number | null,
  nextCost: number,
  laterCredits: number,
  reserve: number,
): boolean {
  if (remaining == null || laterCredits <= 0) return false;
  return remaining - nextCost < laterCredits + reserve;
}
