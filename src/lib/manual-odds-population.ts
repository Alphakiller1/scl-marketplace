import { SURFACE_BOARD_EVENT_LIMIT, type OddsEvent } from "@/lib/odds-board";
import { HARD_MAX_EVENT_BUYS_PER_DAY } from "@/lib/odds-event-buy-budget";
import {
  expandedBoardMarkets,
  withFeaturedGameLineCompanions,
} from "@/lib/odds-verify";

/**
 * Owner priority for sports with per-event expanded boards.
 *
 * This list is also the GATE, not just the order: `parseExpandedSportOrder`
 * drops any requested sport missing from it, so a sport absent here never has
 * its expanded board bought at all, however it is configured elsewhere. NFL
 * props shipped with markets defined, the sport enabled and the schedule due,
 * and still bought nothing for a day — every run completed with `expanded: {}`
 * and zero credits, because the sport fell out here before the loop began.
 *
 * MLB first and soccer last is a budget decision, not a taste one: a full MLB
 * card at full markets costs more than a whole top-up key, so whatever runs
 * after it only gets what the reserve held back. Soccer's expanded call adds a
 * single market (Double Chance) across eighty fixtures, so it is the one that
 * can be cut to a partial slate without leaving a game unbettable.
 *
 * NFL sits second, followed by NCAAF: their cards are cheaper than MLB's, and
 * NCAAF requests only two full-game alternate ladders. Disabled league controls
 * still skip either sport before credits are reserved.
 */
export const DEFAULT_EXPANDED_SPORT_ORDER = [
  "MLB",
  "NFL",
  "NCAAF",
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

/**
 * How many fixtures an expanded pass may buy.
 *
 * The dashboard default of 20 is right for MLB (dozens of markets a game).
 * NCAAF asks for two alternate ladders and plays 60–80 games on a Saturday;
 * slicing that card to 20 left night kickoffs — Purdue vs UCLA — as
 * surface-only after a "successful" expanded run.
 */
export function resolveExpandedEventLimit(
  sport: string,
  requested: number,
): number {
  if (!Number.isFinite(requested) || requested <= 0) return 0;
  const n = Math.floor(requested);
  if (sport.trim().toUpperCase() === "NCAAF") {
    return SURFACE_BOARD_EVENT_LIMIT;
  }
  return Math.min(n, SURFACE_BOARD_EVENT_LIMIT);
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

/**
 * How long before kickoff an event's deep board is worth paying attention to.
 *
 * The allowance is one buy per event (see `DEFAULT_EVENT_BUYS_PER_DAY`), so WHEN
 * that buy lands decides what the board carries for the rest of the day. Books
 * do not open the deep card when the fixture appears — player props and quarter
 * lines arrive hours later, and often only the featured props arrive first. A
 * buy taken too early spends the day's one allowance on a thin board that can
 * never be topped up; a buy taken too late leaves cappers nothing to log.
 *
 * So the window opens where the market plausibly exists and closes at
 * {@link EXPANDED_LAST_CALL_HOURS}, which is the deadline for having something
 * on the board rather than the moment to buy.
 *
 * Football is given the widest opening because its slate is known days out and
 * the books price it early; measured 2026-09-09, the four featured NFL prop
 * markets were live 20 hours before a Wednesday night kickoff.
 */
export const EXPANDED_WINDOW_OPEN_HOURS: Record<string, number> = {
  NFL: 36,
  NCAAF: 36,
  CFL: 36,
  MLB: 20,
  WNBA: 20,
  NBA: 20,
  NCAAB: 20,
  NHL: 20,
  TENNIS: 20,
  SOCCER: 20,
};

const DEFAULT_WINDOW_OPEN_HOURS = 24;

/**
 * The last moment a deep board may be bought.
 *
 * Not a target — a floor. Whatever is priced at this point is what cappers get,
 * because three hours is the least notice worth calling an offer: enough to see
 * the board, build a slip and post it before the line is dead.
 */
export const EXPANDED_LAST_CALL_HOURS = 3;

/**
 * How much of the wanted card must be priced before the one buy is spent.
 *
 * Below last call this holds the allowance back rather than settling for a
 * fraction of the card. Two thirds rather than everything: a book that never
 * prices one alternate ladder must not be able to hold the whole board hostage
 * until last call.
 */
export const EXPANDED_MIN_COVERAGE = 2 / 3;

export function expandedWindowOpenHours(sport: string): number {
  return (
    EXPANDED_WINDOW_OPEN_HOURS[sport.trim().toUpperCase()] ??
    DEFAULT_WINDOW_OPEN_HOURS
  );
}

/** Hours until kickoff; negative once it has started. */
export function hoursToKickoff(commenceTime: string, now: number): number {
  return (Date.parse(commenceTime) - now) / 3_600_000;
}

/** Is this event inside the window where its deep board is worth a look? */
export function withinExpandedBuyWindow(
  commenceTime: string,
  sport: string,
  now: number = Date.now(),
): boolean {
  const hours = hoursToKickoff(commenceTime, now);
  if (!Number.isFinite(hours) || hours <= 0) return false;
  return hours <= expandedWindowOpenHours(sport);
}

/**
 * How far ahead a sport's deep board may be bought for the FIRST time.
 *
 * Football is played in weekly slates that books price days out: a Sunday card
 * carries its featured props by Wednesday, a Saturday NCAAF card its
 * alternate ladders. Held to "today and tomorrow" inside the 36-hour window,
 * those games could not be bought until the day before, so from Monday to
 * Friday the expanded football board looked empty.
 *
 * Inside this horizon but outside {@link EXPANDED_WINDOW_OPEN_HOURS} an event is
 * "early": it is bought once, as soon as its card has opened (the same two-thirds
 * rule as any buy), and not bought again until its own window opens, where the
 * normal cadence takes over. That bounds the early week to one buy per game.
 */
export const EXPANDED_EARLY_BUY_HOURS: Record<string, number> = {
  NFL: 7 * 24,
  // Same weekly shape as NFL: books price Saturday's card days out, and the
  // 36-hour window made a Thursday "run expanded now" succeed against an empty
  // slate. Alternate spreads/totals are two credits a game, so covering the
  // week is cheap enough that holding it back until Friday afternoon is the
  // expensive mistake.
  NCAAF: 7 * 24,
};

export function earlyExpandedBuyHours(sport: string): number | null {
  return EXPANDED_EARLY_BUY_HOURS[sport.trim().toUpperCase()] ?? null;
}

/** Beyond the normal buy window, but inside the sport's early horizon. */
export function isEarlyExpandedEvent(
  commenceTime: string,
  sport: string,
  now: number = Date.now(),
): boolean {
  const horizon = earlyExpandedBuyHours(sport);
  if (horizon == null) return false;
  const hours = hoursToKickoff(commenceTime, now);
  return (
    Number.isFinite(hours) &&
    hours > expandedWindowOpenHours(sport) &&
    hours <= horizon
  );
}

/** Past the point where holding out for a fuller card costs more than it gains. */
export function pastExpandedLastCall(
  commenceTime: string,
  now: number = Date.now(),
): boolean {
  const hours = hoursToKickoff(commenceTime, now);
  return Number.isFinite(hours) && hours <= EXPANDED_LAST_CALL_HOURS;
}

/**
 * Spend the event's one buy, or wait for the rest of the card to open?
 *
 * `priced` is what the market catalog says a covered book is actually pricing,
 * which is the only honest read on whether the card has opened — the catalog
 * costs one credit and, crucially, spends no allowance, so waiting is cheap and
 * repeatable.
 */
export function shouldSpendExpandedBuy(input: {
  priced: readonly string[];
  wanted: readonly string[];
  commenceTime: string;
  now?: number;
}): boolean {
  const now = input.now ?? Date.now();
  if (input.priced.length === 0) return false;
  if (pastExpandedLastCall(input.commenceTime, now)) return true;

  // Coverage is judged on the FEATURED card only. Two thirds of everything
  // requested sounds right until you count what is requested: NFL asks for 28
  // keys, and 13 of them are alternate ladders that plenty of books never post.
  // Measured against the full list, a fixture with every headline market open
  // still scores under the threshold, so the buy waits for last call and the
  // board sits empty all day for markets that were available by breakfast.
  const core = (keys: readonly string[]) => keys.filter((k) => !isAlternate(k));
  const wantedCore = core(input.wanted);
  const pricedCore = core(input.priced);
  if (wantedCore.length === 0) {
    return input.priced.length / input.wanted.length >= EXPANDED_MIN_COVERAGE;
  }
  return pricedCore.length / wantedCore.length >= EXPANDED_MIN_COVERAGE;
}

/** The Odds API spells alternate ladders both ways depending on the market family. */
function isAlternate(key: string): boolean {
  return key.startsWith("alternate_") || key.endsWith("_alternate");
}

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
  // A weekly sport follows its early horizon, not the slate day. Games already
  // inside their buy window go first, so a per-run event cap can never spend
  // itself on next Sunday while tonight's game waits.
  if (sport && earlyExpandedBuyHours(sport) != null) {
    const nowMs = now.getTime();
    const inWindow = future.filter((event) =>
      withinExpandedBuyWindow(event.commenceTime, sport, nowMs),
    );
    const early = future.filter((event) =>
      isEarlyExpandedEvent(event.commenceTime, sport, nowMs),
    );
    const byKickoff = (a: OddsEvent, b: OddsEvent) =>
      Date.parse(a.commenceTime) - Date.parse(b.commenceTime);
    return [...inWindow.sort(byKickoff), ...early.sort(byKickoff)];
  }

  const allowed = new Set<string>();
  if (days.includes("today")) allowed.add(etDay(now));
  if (days.includes("tomorrow")) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    allowed.add(etDay(tomorrow));
  }
  return future.filter((event) => {
    if (!allowed.has(etDay(new Date(event.commenceTime)))) return false;
    // The slate day says which games are in scope; the window says whether the
    // book has plausibly opened their deep card yet. A 20:20 kickoff is "today"
    // from 08:00, but nothing worth one of these buys exists at breakfast.
    return (
      !sport ||
      withinExpandedBuyWindow(event.commenceTime, sport, now.getTime())
    );
  });
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
  return withFeaturedGameLineCompanions(sport, expandedBoardMarkets(sport))
    .length;
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

/**
 * May today's one-buy cap block another expanded fetch?
 *
 * The cap is right for a complete MLB card. It is wrong for NCAAF after a
 * "successful" run that saved only the featured line: Purdue vs UCLA spent
 * its allowance on a surface-shaped board, and every later pass reported
 * `capped` instead of buying the DraftKings alt ladder. Incomplete college
 * boards are four credits; leaving them frozen until 8am ET costs the
 * Saturday card.
 *
 * The bypass still stops at {@link HARD_MAX_EVENT_BUYS_PER_DAY}. Games whose
 * alt ladders never open must not be rebought on every scheduled pass with
 * the hard ceiling lifted.
 */
export function shouldBypassExpandedBuyCap(input: {
  sport: string;
  fullyCovered: boolean;
  buysToday?: number;
}): boolean {
  if (input.sport.trim().toUpperCase() !== "NCAAF") return false;
  if (input.fullyCovered) return false;
  const used = input.buysToday ?? 0;
  return used < HARD_MAX_EVENT_BUYS_PER_DAY;
}

/**
 * How soon a catch-up pass runs once a fixture with no board at all is found.
 *
 * Short, because the thing it is chasing is a fixture the provider published
 * late and the slate is already running: on 2026-09-11 the Cubs matinee reached
 * the MLB board between the 06:15 and 12:15 surface runs, and the expanded tier
 * was not due again until 18:45 — twenty-four minutes after first pitch.
 */
export const EXPANDED_CATCHUP_MINUTES = 15;

/**
 * The floor under two expanded passes for one sport.
 *
 * A fixture whose deep card no book has opened stays uncovered however often we
 * look, so without a floor every surface run would queue another pass behind
 * the last one. Thirty minutes bounds that to something the buy allowance and
 * the catalog credit can both absorb: a pass over an unopened event costs one
 * credit and spends no allowance (see `DEFAULT_EVENT_BUYS_PER_DAY`), so
 * repeating it is cheap — but it is not free, and it is not urgent.
 */
export const EXPANDED_CATCHUP_MIN_GAP_MINUTES = 30;

/**
 * When should the expanded tier next run, given fixtures it has never covered?
 *
 * The expanded pass iterates the slate held by the CACHED surface board, and
 * the two tiers keep independent cadences — MLB surface every 6 hours, expanded
 * every 12. A fixture the provider lists after the expanded pass has run is
 * therefore not held, skipped or capped by that pass; it is never seen at all,
 * and the run reports a clean sweep of the fixtures it did see. Nothing brings
 * the tier back before the full cadence, so the board stays empty through first
 * pitch.
 *
 * Returning a time only ever moves the next run EARLIER. A schedule that is
 * already due sooner is left alone, so this can never defer work.
 */
export function expandedCatchUpRunAt(input: {
  uncovered: number;
  scheduledAt: Date | null;
  lastRunAt: Date | null;
  /**
   * The earliest moment the pass has anything to do. A ladder retry sets it to
   * when the soonest game is due another top-up, so the pass does not wake to
   * find every game still inside its retry spacing.
   */
  notBefore?: Date | null;
  now?: Date;
}): Date | null {
  if (input.uncovered <= 0) return null;
  const now = input.now ?? new Date();
  // The floor is measured from the last pass, not from now: a run that just
  // finished and still left fixtures uncovered must not immediately queue
  // another one.
  const floor = input.lastRunAt
    ? input.lastRunAt.getTime() + EXPANDED_CATCHUP_MIN_GAP_MINUTES * 60_000
    : now.getTime();
  const at = new Date(
    Math.max(
      now.getTime() + EXPANDED_CATCHUP_MINUTES * 60_000,
      floor,
      input.notBefore?.getTime() ?? 0,
    ),
  );
  if (input.scheduledAt && input.scheduledAt.getTime() <= at.getTime()) {
    return null;
  }
  return at;
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

/**
 * Competition identity used to stop paying for a card nobody prices.
 *
 * Soccer (and tennis) post extra markets by COMPETITION: if two EFL Cup ties
 * come back empty, the rest of the cup will too. NCAAF has no league tag —
 * every game is filed under the sport — so treating "NCAAF" as one competition
 * meant two early FCS games without alternate ladders caused the populate to
 * skip the entire Saturday FBS slate, report success, and write nothing.
 *
 * No league tag → each fixture is its own competition (the skip never fans out).
 */
export function unpricedCompetitionKey(event: {
  id: string;
  sport: string;
  league?: string;
}): string {
  const league = event.league?.trim();
  if (league) return `${event.sport}:${league}`;
  return `${event.sport}:${event.id}`;
}

/**
 * Should an expanded pass pay to refresh the cached surface board first?
 *
 * Expanded runs set `surface=0` and iterate the cached slate. That is the
 * right trade when the cache already holds this weekend's games. It is a
 * silent no-op when the cache is empty, and it is how NCAAF "Run expanded now"
 * completed with `ok: true`, zero credits, and no DraftKings lines: Saturday's
 * card had never been written to the 60-event cache, so there were no event
 * ids to buy ladders for.
 *
 * NCAAF is refreshed even when the cache is non-empty, because a Saturday
 * card outgrows the old 60-event cap. Re-reading the surface (three credits)
 * is what puts the rest of the slate — and DraftKings prices on it — in reach
 * of the expanded pass.
 */
export function shouldRefreshSurfaceForExpanded(
  sport: string,
  cachedEvents: readonly { commenceTime: string }[],
  refreshSurface: boolean,
  now = Date.now(),
): boolean {
  if (refreshSurface) return false;
  if (sport.trim().toUpperCase() === "NCAAF") return true;
  return !cachedEvents.some((event) => Date.parse(event.commenceTime) > now);
}

/**
 * Did an expanded pass actually have a slate to walk?
 *
 * `ok` used to ask only whether DEFAULT_SPORTS had surface events. A targeted
 * NCAAF expanded run is not in that list, so it went green with
 * `expanded.NCAAF.events === 0` whenever the cached board was empty or the
 * buy window hid Saturday's games.
 */
export function expandedPassLookedAtSlate(
  expandedLimit: number,
  expanded: Readonly<Record<string, { events: number }>>,
): boolean {
  if (expandedLimit <= 0) return true;
  const rows = Object.values(expanded);
  if (rows.length === 0) return true;
  return rows.some((row) => row.events > 0);
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
