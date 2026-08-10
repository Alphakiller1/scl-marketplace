import { NextResponse } from "next/server";

import { fetchUpcomingOdds } from "@/lib/odds-api";
import { storeOddsBoardEvents } from "@/lib/odds-board-cache";

export const maxDuration = 30;

/** One owner-authorized repair for the WNBA game-picker entry list. */
export async function POST(request: Request) {
  const apiKey = request.headers.get("x-odds-api-key")?.trim();
  if (!apiKey || !/^[A-Za-z0-9_-]{20,200}$/.test(apiKey)) {
    return NextResponse.json(
      { error: "Missing provider key" },
      { status: 401 },
    );
  }

  const events = await fetchUpcomingOdds("WNBA", { apiKeyOverride: apiKey });
  if (events.length === 0) {
    return NextResponse.json(
      { error: "Provider returned no WNBA events" },
      { status: 502 },
    );
  }
  const board = await storeOddsBoardEvents("WNBA", events);

  return NextResponse.json(
    {
      eventCount: board.events.length,
      events: board.events.map((event) => ({
        id: event.id,
        matchup: `${event.away} @ ${event.home}`,
        commenceTime: event.commenceTime,
        coreSelections: event.selections.length,
      })),
      source: board.source,
      stale: board.stale,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
