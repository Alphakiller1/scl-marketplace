import { NextRequest, NextResponse } from "next/server";

import { fetchUpcomingOdds, getLastOddsApiRemaining } from "@/lib/odds-api";
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
  parseExpandedSlateDays,
  selectExpandedSlateEvents,
} from "@/lib/manual-odds-population";

export const maxDuration = 300;

const DEFAULT_SPORTS = ["MLB", "WNBA", "NFL", "TENNIS", "SOCCER"];
/** WNBA first: a 500-credit key cannot finish a full MLB expanded slate AND WNBA. */
const EXPANDED_SPORT_ORDER = ["WNBA", "MLB"] as const;

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

async function populate(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const override = req.headers.get("x-scl-odds-key")?.trim();
  if (override) {
    pinOddsApiKey(override);
    resetOddsKeyPreference();
  }

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
  const surface: Record<
    string,
    { events: number; source: string; stale: boolean }
  > = {};
  const expanded: Record<
    string,
    {
      events: number;
      populated: number;
      skipped: number;
      fetched: number;
      selections: number;
      stale: number;
    }
  > = {};
  const boardEvents = new Map<
    string,
    Awaited<ReturnType<typeof fetchUpcomingOdds>>
  >();

  for (const sport of sports) {
    if (!refreshSurface) {
      const board = await loadCachedOddsBoard(sport);
      boardEvents.set(sport, board.events);
      surface[sport] = {
        events: board.events.length,
        source: board.source,
        stale: board.stale,
      };
      continue;
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

  if (expandedLimit > 0) {
    for (const sport of EXPANDED_SPORT_ORDER.filter((value) =>
      sports.includes(value),
    )) {
      const events = selectExpandedSlateEvents(
        boardEvents.get(sport) ?? [],
        expandedDays,
      ).slice(0, expandedLimit);
      let populated = 0;
      let skipped = 0;
      let fetched = 0;
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
        fetched += 1;
        const board = await loadEventBoard(sport, event.id, {
          forceRefresh: true,
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
        selections,
        stale,
      };
    }
  }

  const mlbReady = !sports.includes("MLB") || (surface.MLB?.events ?? 0) > 0;
  const wnbaReady = !sports.includes("WNBA") || (surface.WNBA?.events ?? 0) > 0;
  return NextResponse.json({
    ok: mlbReady && wnbaReady,
    sports,
    expandedDays,
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
