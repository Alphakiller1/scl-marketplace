import { NextResponse } from "next/server";

import { fetchUpcomingOdds } from "@/lib/odds-api";
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
  const events = await fetchUpcomingOdds(sport);
  return NextResponse.json({ events });
}
