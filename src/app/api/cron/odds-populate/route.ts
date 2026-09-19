import { NextRequest, NextResponse } from "next/server";

import {
  fetchUpcomingOdds,
  getLastOddsApiCapacity,
  getLastOddsApiRemaining,
  getLastOddsApiRunCost,
  resetLastOddsApiUsage,
  resetLastOddsApiRunCost,
  setOddsCircuitBreakSuspended,
} from "@/lib/odds-api";
import {
  circuitBreakThreshold,
  MIN_CIRCUIT_BREAK_RESERVE,
} from "@/lib/odds-budget";
import { pinOddsApiKey } from "@/lib/odds-config";
import { resetOddsKeyPreference } from "@/lib/odds-key-rollover";
import {
  loadCachedOddsBoard,
  updateOddsBoardSegment,
} from "@/lib/odds-board-cache";
import {
  eventsMissingBoard,
  loadCachedEventBoard,
  loadEventBoard,
  topUpEventBoard,
} from "@/lib/odds-event-board-cache";
import {
  summarizeEventMarketCoverage,
  teamTotalGapMarkets,
} from "@/lib/odds-market-coverage";
import {
  canSkipExpandedEvent,
  expandedEventCreditCost,
  expandedPassLookedAtSlate,
  expandsFullSlate,
  isEarlyExpandedEvent,
  laterExpandedCreditReserve,
  parseExpandedMaxAgeMinutes,
  resolveExpandedEventLimit,
  parseExpandedSlateDays,
  parseExpandedSportOrder,
  selectExpandedSlateEvents,
  shouldHoldCreditsForLater,
  shouldRefreshSurfaceForExpanded,
  staleSurfaceSports,
  surfaceRefreshReachedProvider,
  unpricedCompetitionKey,
} from "@/lib/manual-odds-population";
import {
  allowedExpandedMarkets,
  ODDS_CONTROL_SPORTS,
  SURFACE_MARKETS,
} from "@/lib/odds-control";
import {
  managedOddsSchedulingEnabled,
  scheduleExpandedCatchUp,
} from "@/lib/odds-control-runtime";
import { loadLeagueBuyLimits } from "@/lib/odds-league-buy-limits";
import { nextTopUpAt } from "@/lib/odds-event-buy-budget";
import { ALTERNATE_TEAM_TOTAL_MARKET_KEY } from "@/lib/team-total-markets";
import { withFeaturedGameLineCompanions } from "@/lib/odds-verify";

export const maxDuration = 300;

const DEFAULT_SPORTS = ["MLB", "WNBA", "TENNIS", "SOCCER", "NFL"];

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = req.headers.get("authorization");
  return Boolean(
    secret &&
    (authorization === secret || authorization === `Bearer ${secret}`),
  );
}

function requestedSports(req: NextRequest): string[] {
  const requested = (req.nextUrl.searchParams.get("sports") ?? "")
    .split(",")
    .map((sport) => sport.trim().toUpperCase())
    .filter((sport) =>
      (ODDS_CONTROL_SPORTS as readonly string[]).includes(sport),
    );
  return requested.length > 0 ? [...new Set(requested)] : DEFAULT_SPORTS;
}

function selectedValues(req: NextRequest, header: string): string[] {
  return [
    ...new Set(
      (req.headers.get(header) ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}

type SurfaceRow = { events: number; source: string; stale: boolean };
type ExpandedRow = {
  events: number;
  populated: number;
  skipped: number;
  fetched: number;
  held: number;
  selections: number;
  stale: number;
  /** Fixtures skipped because their competition priced none of these markets. */
  unpriced: number;
  /** Fixtures left alone because they have spent today's buy allowance. */
  capped: number;
  /** Boards that gained team-total rungs from a top-up this run. */
  toppedUp: number;
  /** Team-total top-ups asked for (a credit or two each). */
  topUpAttempts: number;
  /** Boards missing a ladder but inside their retry spacing, or out of tries. */
  ladderWaiting: number;
  /** Slate fixtures ahead of their buy window, eligible for one early buy. */
  early: number;
  /** Earliest and latest kickoff on the slate, so an empty pass says why. */
  firstKickoff: string | null;
  lastKickoff: string | null;
};

/**
 * Consecutive empty expanded boards before the rest of a competition is left
 * alone for this run.
 *
 * Books post the non-surface markets by competition, not by fixture: either the
 * league's card carries Double Chance or none of it does. Without this, one
 * populate paid a call for all twenty EFL Cup ties and got nothing on any of
 * them, and did it again on the next run — a fixture nobody prices never
 * reaches full coverage, so `skipPopulated` cannot learn to skip it.
 */
const UNPRICED_COMPETITION_LIMIT = 2;

async function loadSurface(
  sport: string,
  refreshSurface: boolean,
  boardEvents: Map<string, Awaited<ReturnType<typeof fetchUpcomingOdds>>>,
  surface: Record<string, SurfaceRow>,
  options?: { markets?: readonly string[]; leagues?: readonly string[] },
): Promise<void> {
  if (!refreshSurface) {
    const board = await loadCachedOddsBoard(sport);
    boardEvents.set(sport, board.events);
    surface[sport] = {
      events: board.events.length,
      source: board.source,
      stale: board.stale,
    };
    return;
  }
  let fresh = [] as Awaited<ReturnType<typeof fetchUpcomingOdds>>;
  try {
    fresh = await fetchUpcomingOdds(sport, options);
  } catch (error) {
    console.warn("[odds-populate] surface provider failure", {
      sport,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
  const board = await updateOddsBoardSegment(sport, undefined, fresh);
  boardEvents.set(sport, board.events);
  surface[sport] = {
    events: board.events.length,
    source: board.source,
    stale: board.stale,
  };
}

async function populate(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let managedSchedulingEnabled: boolean;
  try {
    managedSchedulingEnabled = await managedOddsSchedulingEnabled();
  } catch (error) {
    console.error("[odds-populate] owner controls unavailable", error);
    return NextResponse.json(
      { ok: false, error: "Odds control storage is unavailable." },
      { status: 503 },
    );
  }

  if (
    managedSchedulingEnabled &&
    req.headers.get("x-scl-managed-run") !== "1"
  ) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "managed_scheduler_active",
    });
  }

  const override = req.headers.get("x-scl-odds-key")?.trim();
  if (override) {
    pinOddsApiKey(override);
    resetOddsKeyPreference();
    // Warm Fluid isolates keep lastOddsApiRemaining from the spent Vercel
    // key. Leaving it at 0 circuit-breaks every surface before the first
    // request, so the one-shot key is never used.
    resetLastOddsApiUsage();
    setOddsCircuitBreakSuspended(true);
  }

  try {
    return await runPopulate(req, managedSchedulingEnabled);
  } finally {
    if (override) setOddsCircuitBreakSuspended(false);
  }
}

async function runPopulate(req: NextRequest, managedScheduling: boolean) {
  resetLastOddsApiRunCost();
  const sports = requestedSports(req);
  const requestedSurfaceMarkets = selectedValues(req, "x-scl-surface-markets");
  const allowedSurface = new Set(SURFACE_MARKETS.map((market) => market.key));
  const surfaceMarkets = requestedSurfaceMarkets.filter((market) =>
    allowedSurface.has(market as "h2h" | "spreads" | "totals"),
  );
  const requestedExpandedMarkets = selectedValues(
    req,
    "x-scl-expanded-markets",
  );
  const expandedMarkets =
    sports.length === 1
      ? requestedExpandedMarkets.filter((market) =>
          allowedExpandedMarkets(sports[0]!).includes(market),
        )
      : [];
  const leagues = selectedValues(req, "x-scl-leagues");
  const requestedExpanded = Number(
    req.nextUrl.searchParams.get("expanded") ?? 0,
  );
  const expandedLimit = Number.isFinite(requestedExpanded)
    ? Math.max(0, Math.floor(requestedExpanded))
    : 0;
  const expandedDays = parseExpandedSlateDays(
    req.nextUrl.searchParams.get("expandedDays") ?? "tomorrow",
  );
  const refreshSurface = req.nextUrl.searchParams.get("surface") !== "0";
  // Default on: a top-up key should fill missing expanded boards, not rebill
  // the ones already cached. Pass skipPopulated=0 to force a full re-fetch.
  const skipPopulated = req.nextUrl.searchParams.get("skipPopulated") !== "0";
  // How stale an already-complete expanded board may be before this run pays to
  // move it. Tunable from the cron URL so the deep-board spend can be traded
  // against the credit budget without a deploy.
  // An owner forcing a rebuild can spend past the per-event daily cap. It is a
  // query flag rather than the default because the cap is the thing standing
  // between a fifteen-game slate and eight re-buys a day.
  const ignoreBuyCap = req.nextUrl.searchParams.get("ignoreBuyCap") === "1";
  // A team-total top-up run fills missing ladders on boards already bought and
  // buys nothing else. `topUpForce` is the owner pressing the button: it skips
  // the hourly spacing between top-ups, not the credit reserve.
  const teamTotalTopUpOnly =
    req.nextUrl.searchParams.get("topUp") === "teamTotals";
  const topUpForce = req.nextUrl.searchParams.get("topUpForce") === "1";

  const expandedMaxAgeMinutes = parseExpandedMaxAgeMinutes(
    req.nextUrl.searchParams.get("expandedMaxAgeMinutes"),
  );
  const expandedOrder = parseExpandedSportOrder(
    req.nextUrl.searchParams.get("expandedOrder"),
    sports,
  );
  const restSports = sports.filter((sport) => !expandedOrder.includes(sport));
  const surface: Record<string, SurfaceRow> = {};
  const expanded: Record<string, ExpandedRow> = {};
  const boardEvents = new Map<
    string,
    Awaited<ReturnType<typeof fetchUpcomingOdds>>
  >();

  // Surface MLB/WNBA first so today's event ids exist, then tennis/soccer
  // (cheap, in-season this week), then leftover credits on the NFL board.
  // Tennis after NFL is how Cincinnati lost the last populate: NFL spent the
  // key down to 29 credits and the 1,000-credit breaker skipped the Masters.
  for (const sport of expandedOrder) {
    await loadSurface(sport, refreshSurface, boardEvents, surface, {
      markets: surfaceMarkets.length ? surfaceMarkets : undefined,
      leagues: leagues.length ? leagues : undefined,
    });
  }

  if (expandedLimit > 0 && !refreshSurface) {
    for (const sport of expandedOrder) {
      if (
        shouldRefreshSurfaceForExpanded(
          sport,
          boardEvents.get(sport) ?? [],
          refreshSurface,
        )
      ) {
        await loadSurface(sport, true, boardEvents, surface, {
          markets: surfaceMarkets.length ? surfaceMarkets : undefined,
          leagues: leagues.length ? leagues : undefined,
        });
      }
    }
  }

  if (expandedLimit > 0) {
    // Each league's own daily allowance, read once for the whole run. A league
    // with no saved row falls back to the shared default rather than to no cap.
    const buyLimitsBySport = await loadLeagueBuyLimits();
    const slates = expandedOrder.map((sport) => ({
      sport,
      events: selectExpandedSlateEvents(
        boardEvents.get(sport) ?? [],
        expandedDays,
        new Date(),
        sport,
      ).slice(0, resolveExpandedEventLimit(sport, expandedLimit)),
    }));
    for (let index = 0; index < slates.length; index += 1) {
      const { sport, events } = slates[index]!;
      const laterCredits = laterExpandedCreditReserve(
        slates.slice(index + 1).map((row) => ({
          sport: row.sport,
          events: row.events.length,
        })),
      );
      let populated = 0;
      let skipped = 0;
      let fetched = 0;
      let held = 0;
      let selections = 0;
      let stale = 0;
      let unpriced = 0;
      let capped = 0;
      let toppedUp = 0;
      let topUpAttempts = 0;
      let ladderWaiting = 0;
      let early = 0;
      // What this run may ask for: the owner's selection on a managed run, the
      // sport's full expanded list otherwise. A top-up never reaches past it.
      // NCAAF alt ladders also buy featured spreads/totals because DraftKings
      // files those rungs there — billed keys, not dashboard checkboxes.
      const sportMarkets = withFeaturedGameLineCompanions(
        sport,
        expandedMarkets.length
          ? expandedMarkets
          : allowedExpandedMarkets(sport),
      );
      const nextCost = sportMarkets.length || expandedEventCreditCost(sport);
      // One lookup per sport rather than per event: the allowance is a league
      // setting, and the inner loop runs once per fixture on the slate.
      const buyLimit = buyLimitsBySport.get(sport) ?? null;
      const emptyRuns = new Map<string, number>();
      for (const event of events) {
        const competition = unpricedCompetitionKey(event);
        if ((emptyRuns.get(competition) ?? 0) >= UNPRICED_COMPETITION_LIMIT) {
          unpriced += 1;
          continue;
        }
        // Read the cache first whether or not `skipPopulated` is set: it is
        // free, and it carries the buy log the daily cap is decided from.
        // Checking here rather than only inside `loadEventBoard` is what lets a
        // run REPORT how many events it declined to re-buy — a cap that is
        // enforced but invisible looks exactly like a broken populate.
        const cached = await loadCachedEventBoard(sport, event.id, buyLimit);
        const coverage = summarizeEventMarketCoverage(
          event,
          cached.selections,
          cached.source,
          cached.stale,
        );
        // An early fixture is bought once when its card is actually complete.
        // Skipping any saved snapshot froze Saturday night NCAAF games that
        // were bought Thursday with only the featured line — Purdue vs UCLA
        // stayed surface-only until kickoff week after week.
        const isEarly = isEarlyExpandedEvent(event.commenceTime, sport);
        if (isEarly) early += 1;
        if (isEarly && cached.savedAt != null && coverage.fullyCovered) {
          skipped += 1;
          populated += 1;
          selections += cached.selections.length;
          continue;
        }
        // Team totals are the one gap closed WITHOUT rebuying the board.
        //
        // Caesars posts the MLB alternate team-total ladder game by game, often
        // hours after the other books open the card. A board bought before it
        // arrives carries only the featured line per club, and with one buy a
        // day it stayed that way: on 2026-09-15 seven of fifteen games had no
        // ladder, and no Over 2.5 for either club. Rebuying fifty-odd markets
        // to fetch one is the wrong trade, so the ladder is asked for on its
        // own and added to the board without moving a price it already holds.
        const ladderGap =
          cached.savedAt == null
            ? null
            : (teamTotalGapMarkets(coverage.missing)?.filter((key) =>
                sportMarkets.includes(key),
              ) ?? null);
        const boardWithinAge =
          cached.savedAt != null &&
          Date.now() - cached.savedAt <= expandedMaxAgeMinutes * 60_000;
        const boardCapped = !ignoreBuyCap && cached.buysRemaining <= 0;
        // A capped board is included deliberately: it cannot be rebought today,
        // so a top-up is the only thing that can still fill it — and without an
        // attempt logged, the catch-up scheduler would wake a pass every half
        // hour to find it capped again.
        if (
          ladderGap?.length &&
          (teamTotalTopUpOnly || boardWithinAge || boardCapped)
        ) {
          const dueAt = topUpForce ? Date.now() : nextTopUpAt(cached.topUps);
          if (dueAt == null || dueAt > Date.now()) {
            ladderWaiting += 1;
            populated += 1;
            selections += cached.selections.length;
            continue;
          }
          if (
            shouldHoldCreditsForLater(
              getLastOddsApiRemaining(),
              ladderGap.length,
              laterCredits,
              MIN_CIRCUIT_BREAK_RESERVE,
            )
          ) {
            held += 1;
            continue;
          }
          const topUp = await topUpEventBoard(sport, event.id, {
            league: event.league,
            markets: ladderGap,
          });
          topUpAttempts += 1;
          if (topUp.added > 0) toppedUp += 1;
          populated += 1;
          selections += topUp.selections;
          continue;
        }
        // A top-up run fills ladders and nothing else. Buying a whole board from
        // it would turn a credit-a-game button into a fifty-credit one.
        if (teamTotalTopUpOnly) {
          skipped += 1;
          if (cached.savedAt != null) populated += 1;
          selections += cached.selections.length;
          continue;
        }
        if (boardCapped) {
          capped += 1;
          populated += 1;
          selections += cached.selections.length;
          continue;
        }
        if (
          skipPopulated &&
          canSkipExpandedEvent(
            coverage.fullyCovered,
            cached.savedAt,
            expandedMaxAgeMinutes,
          )
        ) {
          skipped += 1;
          populated += 1;
          selections += cached.selections.length;
          continue;
        }
        if (
          shouldHoldCreditsForLater(
            getLastOddsApiRemaining(),
            nextCost,
            laterCredits,
            MIN_CIRCUIT_BREAK_RESERVE,
          )
        ) {
          held += 1;
          continue;
        }
        fetched += 1;
        const board = await loadEventBoard(sport, event.id, {
          forceRefresh: true,
          league: event.league,
          markets: sportMarkets.length ? sportMarkets : undefined,
          ignoreDailyBuyCap: ignoreBuyCap,
          dailyBuyLimit: buyLimit,
          // The scheduled sweep is the path the one-buy allowance is spent on,
          // so it is the path that has to wait for the card to open.
          commenceTime: event.commenceTime,
        });
        if (board.selections.length > 0) {
          populated += 1;
          emptyRuns.set(competition, 0);
        } else {
          emptyRuns.set(competition, (emptyRuns.get(competition) ?? 0) + 1);
        }
        selections += board.selections.length;
        if (board.stale) stale += 1;
      }
      expanded[sport] = {
        events: events.length,
        populated,
        skipped,
        fetched,
        held,
        selections,
        stale,
        unpriced,
        capped,
        toppedUp,
        topUpAttempts,
        ladderWaiting,
        early,
        firstKickoff: events[0]?.commenceTime ?? null,
        lastKickoff: events.at(-1)?.commenceTime ?? null,
      };
      // One line per sport per pass. A pass with nothing on its slate makes no
      // provider call, so without this it left no trace in the logs at all —
      // which is how "NFL expanded never ran" and "NFL expanded ran over an
      // empty slate" became impossible to tell apart.
      console.info("[odds-populate] expanded pass", {
        sport,
        at: new Date().toISOString(),
        ...expanded[sport],
      });
    }
  }

  for (const sport of restSports) {
    await loadSurface(sport, refreshSurface, boardEvents, surface, {
      markets: surfaceMarkets.length ? surfaceMarkets : undefined,
      leagues: leagues.length ? leagues : undefined,
    });
  }

  // Which fixtures on the CURRENT slate have no expanded board at all.
  //
  // This is the question the run report never asked. A pass reports what it
  // held, skipped, capped and bought out of the slate it was handed; it cannot
  // report a fixture that was not on that slate, and a fixture the provider
  // publishes between two passes is exactly that. Counting from the store
  // instead of from the loop is what makes a half-covered board visible, and
  // what tells the scheduler to come back.
  const uncovered: Record<string, number> = {};
  const teamTotalLadderGaps: Record<string, number> = {};
  const catchUp: Record<string, string> = {};
  for (const sport of expandedOrder) {
    const slate = selectExpandedSlateEvents(
      boardEvents.get(sport) ?? [],
      expandedDays,
      new Date(),
      sport,
    );
    if (slate.length === 0) continue;
    const missing = await eventsMissingBoard(
      sport,
      slate.map((event) => event.id),
    );
    if (missing.length > 0) uncovered[sport] = missing.length;
    // Early fixtures are reported with the rest but not chased: their card is
    // often unopened days out, and a half-hourly catch-up would read every
    // catalog on next week's slate for nothing. The regular cadence retries them.
    const eventsById = new Map(slate.map((event) => [event.id, event]));
    const missingInWindow = missing.filter((id) => {
      const event = eventsById.get(id);
      return !event || !isEarlyExpandedEvent(event.commenceTime, sport);
    });

    // Boards that exist but still lack a club's team-total ladder, counted from
    // the store for the same reason as a missing board: the pass that bought
    // them cannot know which books have posted since, and a surface run never
    // looks at deep boards at all. Only sports that can ask for the ladder are
    // read, so a tennis or football run pays for no reads here.
    let ladderGaps = 0;
    let ladderRetryAt: number | null = null;
    if (
      !expandsFullSlate(sport) &&
      allowedExpandedMarkets(sport).includes(ALTERNATE_TEAM_TOTAL_MARKET_KEY)
    ) {
      const missingIds = new Set(missing);
      for (const event of slate) {
        if (missingIds.has(event.id)) continue;
        const cached = await loadCachedEventBoard(sport, event.id);
        const gap = teamTotalGapMarkets(
          summarizeEventMarketCoverage(
            event,
            cached.selections,
            cached.source,
            cached.stale,
          ).missing,
        );
        if (!gap?.length) continue;
        ladderGaps += 1;
        // Out of tries for the buy day: reported, but nothing to wake for.
        const retryAt = nextTopUpAt(cached.topUps);
        if (retryAt == null) continue;
        ladderRetryAt =
          ladderRetryAt == null ? retryAt : Math.min(ladderRetryAt, retryAt);
      }
    }
    if (ladderGaps > 0) teamTotalLadderGaps[sport] = ladderGaps;

    // Only the managed scheduler owns `nextExpandedRunAt`. Under the fixed
    // `vercel.json` cadence there is no schedule row to move, and the next
    // listed run comes round soon enough on its own.
    if (!managedScheduling) continue;
    // Report the gap for every sport, but only CHASE it where an empty board
    // means something went wrong. A full-slate sport is the counter-example:
    // soccer expands the whole multi-day board for a single market that plenty
    // of competitions never post at all, so "no board" is its steady state, not
    // a miss — `UNPRICED_COMPETITION_LIMIT` exists for exactly that shape. A
    // board that will never exist would otherwise re-queue a pass every half
    // hour for as long as the fixture is on the board.
    if (expandsFullSlate(sport)) continue;
    if (missingInWindow.length > 0) {
      const at = await scheduleExpandedCatchUp(sport, missingInWindow.length);
      if (at) catchUp[sport] = at.toISOString();
    } else if (ladderRetryAt != null) {
      // Wakes when the soonest thin game is due another top-up, and only where
      // the owner still has the ladder switched on.
      const at = await scheduleExpandedCatchUp(sport, ladderGaps, new Date(), {
        notBefore: new Date(ladderRetryAt),
        requireMarkets: [ALTERNATE_TEAM_TOTAL_MARKET_KEY],
      });
      if (at) catchUp[sport] = at.toISOString();
    }
  }

  const surfaceReady = (sport: string) =>
    !sports.includes(sport) || (surface[sport]?.events ?? 0) > 0;

  const refreshedSports = Object.values(surface).filter(
    (row) => row.source === "provider",
  ).length;
  const staleSports = staleSurfaceSports(surface);
  const remaining = getLastOddsApiRemaining();
  const capacity = getLastOddsApiCapacity();
  const provider = {
    requestsRemaining: remaining,
    capacity,
    circuitBreakThreshold: circuitBreakThreshold(capacity),
    // Below the reserve nothing uncached will fetch, so the board is frozen
    // whatever the cadence says.
    exhausted: remaining != null && remaining <= 0,
    refreshedSports,
    staleSports,
  };

  // `ok` used to ask only whether the cached board held events, which is true of
  // yesterday's board too. Every scheduled run since the production key hit zero
  // credits therefore reported success while writing nothing: five sports came
  // back `stale_provider_failure`, the job went green, and the board silently
  // stopped moving. A refresh that was asked for and reached no fresh price is
  // a failed refresh, and has to say so.
  const surfaceRefreshed = surfaceRefreshReachedProvider(
    refreshSurface,
    surface,
  );
  const expandedReady = expandedPassLookedAtSlate(expandedLimit, expanded);
  return NextResponse.json({
    ok: DEFAULT_SPORTS.every(surfaceReady) && surfaceRefreshed && expandedReady,
    surfaceRefreshed,
    sports,
    expandedDays,
    expandedOrder,
    refreshSurface,
    skipPopulated,
    expandedMaxAgeMinutes,
    surfaceMarkets:
      surfaceMarkets.length > 0
        ? surfaceMarkets
        : SURFACE_MARKETS.map((market) => market.key),
    expandedMarkets,
    leagues,
    creditsUsed: getLastOddsApiRunCost(),
    surface,
    expanded,
    uncovered,
    teamTotalLadderGaps,
    catchUp,
    topUp: teamTotalTopUpOnly,
    provider,
    requestsRemaining: remaining,
  });
}

export async function POST(req: NextRequest) {
  return populate(req);
}

export async function GET(req: NextRequest) {
  return populate(req);
}
