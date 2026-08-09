import { NextResponse } from "next/server";

import { getCapperBooks } from "@/lib/capper-books";
import { fetchEventBoard, oddsApiKey } from "@/lib/odds-api";
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
  const books = await getCapperBooks(user.id);
  const selections =
    sport && eventId ? await fetchEventBoard(sport, eventId, { books }) : [];
  if (selections.length === 0) {
    console.warn("[odds-board] event detail empty", {
      sport,
      hasEventId: Boolean(eventId),
      durationMs: Date.now() - startedAt,
    });
  } else {
    console.info("[odds-board] event detail ready", {
      sport,
      selectionCount: selections.length,
      durationMs: Date.now() - startedAt,
    });
  }
  return NextResponse.json({
    selections,
    configured: Boolean(oddsApiKey()),
    books,
  });
}
