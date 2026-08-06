import { NextResponse } from "next/server";

import { getCapperBooks } from "@/lib/capper-books";
import {
  buildOddsBoardMeta,
  fetchUpcomingOdds,
  getLastOddsApiRemaining,
  oddsApiKey,
} from "@/lib/odds-api";
import { shouldCircuitBreak } from "@/lib/odds-budget";
import { maybeSweepGrading } from "@/lib/results/auto-grade-sweep";
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
  // Cappers browsing the board are the most reliable traffic this app gets, so
  // it carries the grading heartbeat too. Globally throttled, fire-and-forget.
  void maybeSweepGrading();

  const sport = new URL(request.url).searchParams.get("sport") ?? "";
  const books = await getCapperBooks(user.id);
  const configured = Boolean(oddsApiKey());
  const circuitBreak = shouldCircuitBreak(getLastOddsApiRemaining());
  const events =
    configured && !circuitBreak
      ? await fetchUpcomingOdds(sport, { books })
      : [];
  const meta = buildOddsBoardMeta(sport, events.length, {
    configured,
    circuitBreak,
  });

  return NextResponse.json({
    events,
    configured,
    books,
    meta,
  });
}
