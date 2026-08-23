import { NextRequest, NextResponse } from "next/server";

import {
  fetchUpcomingOdds,
  getLastOddsApiRemaining,
  resetLastOddsApiUsage,
  setOddsCircuitBreakSuspended,
} from "@/lib/odds-api";
import { MIN_CIRCUIT_BREAK_RESERVE } from "@/lib/odds-budget";
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
  expandedEventCreditCost,
  laterExpandedCreditReserve,
  parseExpandedSlateDays,
  parseExpandedSportOrder,
  selectExpandedSlateEvents,
  shouldHoldCreditsForLater,
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
};

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
  // A market top-up: fetch only these and merge them into the stored board.
  // Books post the alternate ladders a few hours before first pitch, so the
  // overnight populate writes a board that is complete except for them, and
  // re-billing the sport's whole list to collect one market (44 credits an
  // event on MLB against 1) is what a key that already paid for the slate
  // cannot afford.
  const marketOverride = (req.nextUrl.searchParams.get("markets") ?? "")
    .split(",")
    .map((market) => market.trim())
    .filter(Boolean);
  const refreshSurface = req.nextUrl.searchParams.get("surface") !== "0";
  // Default on: a top-up key should fill missing expanded boards, not rebill
  // the ones already cached. Pass skipPopulated=0 to force a full re-fetch.
  //
  // A market override never skips: coverage asks whether a market is present at
  // all, and the board this is meant to repair passes that test — four team
  // totals where the book prices forty read as covered, which would skip every
  // event and make the top-up a no-op.
  const skipPopulated =
    marketOverride.length === 0 &&
    req.nextUrl.searchParams.get("skipPopulated") !== "0";
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
      ).slice(0, expandedLimit),
    }));
    for (let index = 0; index < slates.length; index += 1) {
      const { sport, events } = slates[index]!;
      const laterCredits = marketOverride.length
        ? slates
            .slice(index + 1)
            .reduce(
              (sum, row) => sum + row.events.length * marketOverride.length,
              0,
            )
        : laterExpandedCreditReserve(
            slates.slice(index + 1).map((row) => ({
              sport: row.sport,
              events: row.events.length,
            })),
          );
      const nextCost = marketOverride.length || expandedEventCreditCost(sport);
      let populated = 0;
      let skipped = 0;
      let fetched = 0;
      let held = 0;
      let selections = 0;
      let stale = 0;
      for (const event of events) {
        if (skipPopulated) {
          const cached = await loadCachedEventBoard(sport, event.id);
          const coverage = summarizeEventMarketCoverage(
            event,
            cached.selections,
            cached.source,
            cached.stale,
          );
          if (coverage.fullyCovered) {
            skipped += 1;
            populated += 1;
            selections += cached.selections.length;
            if (cached.stale) stale += 1;
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
          ...(marketOverride.length ? { markets: marketOverride } : {}),
        });
        if (board.selections.length > 0) populated += 1;
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
      };
    }
  }

  for (const sport of restSports) {
    await loadSurface(sport, refreshSurface, boardEvents, surface);
  }

  const surfaceReady = (sport: string) =>
    !sports.includes(sport) || (surface[sport]?.events ?? 0) > 0;
  return NextResponse.json({
    ok: DEFAULT_SPORTS.every(surfaceReady),
    sports,
    expandedDays,
    expandedOrder,
    ...(marketOverride.length ? { markets: marketOverride } : {}),
    refreshSurface,
    skipPopulated,
    surface,
    expanded,
    requestsRemaining: getLastOddsApiRemaining(),
  });
}

export async function POST(req: NextRequest) {
  return populate(req);
}

export async function GET(req: NextRequest) {
  return populate(req);
}
