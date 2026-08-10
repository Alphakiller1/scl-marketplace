import { NextResponse } from "next/server";

import { logOddsUsage, resolveOddsApiSport } from "@/lib/odds-api";
import { loadCachedOddsBoard } from "@/lib/odds-board-cache";
import { normalizeEventBoard, type OddsEvent } from "@/lib/odds-board";
import { storeEventBoardSelections } from "@/lib/odds-event-board-cache";
import { expandedBoardMarkets, type RawEventOdds } from "@/lib/odds-verify";

export const maxDuration = 60;

const SPORTS = ["MLB", "WNBA"] as const;
const EASTERN_DATE = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function easternDateKey(date: Date): string {
  const parts = Object.fromEntries(
    EASTERN_DATE.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function todaysPregameEvents(events: OddsEvent[], now: Date): OddsEvent[] {
  const today = easternDateKey(now);
  return events.filter((event) => {
    const startsAt = new Date(event.commenceTime);
    return (
      startsAt.getTime() > now.getTime() && easternDateKey(startsAt) === today
    );
  });
}

/**
 * One-time owner-authorized fill for today's MLB/WNBA expanded markets.
 * The temporary provider key arrives only in a request header and is never stored.
 */
export async function POST(request: Request) {
  const apiKey = request.headers.get("x-odds-api-key")?.trim();
  if (!apiKey || !/^[A-Za-z0-9_-]{20,200}$/.test(apiKey)) {
    return NextResponse.json(
      { error: "Missing provider key" },
      { status: 401 },
    );
  }

  const now = new Date();
  const boards = await Promise.all(
    SPORTS.map(async (sport) => ({
      sport,
      board: await loadCachedOddsBoard(sport),
    })),
  );
  const events = boards.flatMap(({ sport, board }) =>
    todaysPregameEvents(board.events, now).map((event) => ({ sport, event })),
  );

  const results = await Promise.all(
    events.map(async ({ sport, event }) => {
      const apiSport = resolveOddsApiSport(sport, event.league);
      if (!apiSport) {
        return { sport, eventId: event.id, status: "unsupported" as const };
      }
      const markets = expandedBoardMarkets(sport);
      const url =
        `https://api.the-odds-api.com/v4/sports/${apiSport}/events/${event.id}/odds/` +
        `?apiKey=${encodeURIComponent(apiKey)}&regions=us&markets=${encodeURIComponent(markets.join(","))}&oddsFormat=american`;
      const response = await fetch(url, { cache: "no-store" });
      logOddsUsage(response, `authorized prewarm ${event.id}`, "board", sport);
      if (!response.ok) {
        return {
          sport,
          eventId: event.id,
          status: `provider_${response.status}` as const,
        };
      }
      const raw = (await response.json()) as RawEventOdds;
      const selections = normalizeEventBoard(raw);
      if (selections.length > 0) {
        await storeEventBoardSelections(sport, event.id, selections);
      }
      return {
        sport,
        eventId: event.id,
        status:
          selections.length > 0 ? ("filled" as const) : ("empty" as const),
        selections: selections.length,
      };
    }),
  );

  return NextResponse.json(
    {
      date: easternDateKey(now),
      requestedEvents: events.length,
      filledEvents: results.filter((result) => result.status === "filled")
        .length,
      results,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
