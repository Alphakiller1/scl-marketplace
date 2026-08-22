import { NextResponse } from "next/server";

import { oddsApiKey } from "@/lib/odds-api";
import { loadEventBoard } from "@/lib/odds-event-board-cache";
import { getCurrentUser } from "@/lib/session";

/**
 * Expanded board for a single event — featured + alternate game lines. Fetched lazily when a
 * capper opens an event on the entry form, so we only spend the per-event credit on games they
 * actually look at (and it shares the cached verification snapshot). Server-side so the key never
 * reaches the browser.
 * GET /api/odds/event?sport=NBA&eventId=abc123
 */
export async function GET(request: Request) {
  const startedAt = Date.now();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const sport = params.get("sport") ?? "";
  const eventId = params.get("eventId") ?? "";
  const league = params.get("league");
  const board =
    sport && eventId
      ? await loadEventBoard(sport, eventId, { league })
      : {
          selections: [],
          source: "provider_empty" as const,
          stale: false,
        };
  const { selections } = board;
  if (selections.length === 0) {
    console.warn("[odds-board] event detail empty", {
      sport,
      hasEventId: Boolean(eventId),
      source: board.source,
      durationMs: Date.now() - startedAt,
    });
  } else {
    console.info("[odds-board] event detail ready", {
      sport,
      selectionCount: selections.length,
      source: board.source,
      stale: board.stale,
      durationMs: Date.now() - startedAt,
    });
  }
  return NextResponse.json(
    {
      selections,
      configured: Boolean(oddsApiKey()),
      meta: { source: board.source, stale: board.stale },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
