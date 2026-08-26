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

/** Select only the ET slate days that should receive metered event markets. */
export function selectExpandedSlateEvents(
  events: readonly OddsEvent[],
  days: readonly ExpandedSlateDay[],
  now = new Date(),
): OddsEvent[] {
  const allowed = new Set<string>();
  if (days.includes("today")) allowed.add(etDay(now));
  if (days.includes("tomorrow")) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    allowed.add(etDay(tomorrow));
  }
  return events.filter(
    (event) =>
      Date.parse(event.commenceTime) > now.getTime() &&
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
