import { NextRequest, NextResponse } from "next/server";

import {
  fetchUpcomingOdds,
  getLastOddsApiCapacity,
  getLastOddsApiRemaining,
  resetLastOddsApiUsage,
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
  loadCachedEventBoard,
  loadEventBoard,
} from "@/lib/odds-event-board-cache";
import { summarizeEventMarketCoverage } from "@/lib/odds-market-coverage";
import {
  canSkipExpandedEvent,
  expandedEventCreditCost,
  laterExpandedCreditReserve,
  parseExpandedMaxAgeMinutes,
  parseExpandedSlateDays,
  parseExpandedSportOrder,
  selectExpandedSlateEvents,
  shouldHoldCreditsForLater,
  staleSurfaceSports,
  surfaceRefreshReachedProvider,
} from "@/lib/manual-odds-population";

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
    .filter((sport) => DEFAULT_SPORTS.includes(sport));
  return requested.length > 0 ? [...new Set(requested)] : DEFAULT_SPORTS;
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
    fresh = await fetchUpcomingOdds(sport);
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
    return await runPopulate(req);
  } finally {
    if (override) setOddsCircuitBreakSuspended(false);
  }
}

async function runPopulate(req: NextRequest) {
  const sports = requestedSports(req);
  const requestedExpanded = Number(
    req.nextUrl.searchParams.get("expanded") ?? 0,
  );
  const expandedLimit = Number.isFinite(requestedExpanded)
    ? Math.max(0, Math.min(99, Math.floor(requestedExpanded)))
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
    await loadSurface(sport, refreshSurface, boardEvents, surface);
  }

  if (expandedLimit > 0) {
    const slates = expandedOrder.map((sport) => ({
      sport,
      events: selectExpandedSlateEvents(
        boardEvents.get(sport) ?? [],
        expandedDays,
        new Date(),
        sport,
      ).slice(0, expandedLimit),
    }));
    for (let index = 0; index < slates.length; index += 1) {
      const { sport, events } = slates[index]!;
      const laterCredits = laterExpandedCreditReserve(
        slates.slice(index + 1).map((row) => ({
          sport: row.sport,
          events: row.events.length,
        })),
      );
      const nextCost = expandedEventCreditCost(sport);
      let populated = 0;
      let skipped = 0;
      let fetched = 0;
      let held = 0;
      let selections = 0;
      let stale = 0;
      let unpriced = 0;
      const emptyRuns = new Map<string, number>();
      for (const event of events) {
        const competition = event.league ?? sport;
        if ((emptyRuns.get(competition) ?? 0) >= UNPRICED_COMPETITION_LIMIT) {
          unpriced += 1;
          continue;
        }
        if (skipPopulated) {
          const cached = await loadCachedEventBoard(sport, event.id);
          const coverage = summarizeEventMarketCoverage(
            event,
            cached.selections,
            cached.source,
            cached.stale,
          );
          if (
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
      };
    }
  }

  for (const sport of restSports) {
    await loadSurface(sport, refreshSurface, boardEvents, surface);
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
  return NextResponse.json({
    ok: DEFAULT_SPORTS.every(surfaceReady) && surfaceRefreshed,
    surfaceRefreshed,
    sports,
    expandedDays,
    expandedOrder,
    refreshSurface,
    skipPopulated,
    expandedMaxAgeMinutes,
    surface,
    expanded,
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
