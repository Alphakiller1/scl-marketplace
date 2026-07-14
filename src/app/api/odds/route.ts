import { NextResponse } from "next/server";

import { getCapperBooks } from "@/lib/capper-books";
import { fetchUpcomingOdds, oddsApiKey } from "@/lib/odds-api";
import { getCurrentUser } from "@/lib/session";

/**
 * Odds-assist feed for the play-entry form. Server-side so ODDS_API_KEY never
 * reaches the browser. Returns [] when the key/sport is unavailable.
 * GET /api/odds?sport=NBA
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sport = new URL(request.url).searchParams.get("sport") ?? "";
  const books = await getCapperBooks(user.id);
  const events = await fetchUpcomingOdds(sport, { books });
  // `configured` lets the UI distinguish "no API key" from "no games right now".
  return NextResponse.json({
    events,
    configured: Boolean(oddsApiKey()),
  });
}
