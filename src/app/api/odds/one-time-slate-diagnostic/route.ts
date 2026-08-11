import { NextResponse } from "next/server";

import { loadCachedOddsBoard } from "@/lib/odds-board-cache";
import type { OddsSelection } from "@/lib/odds-board";
import { loadCachedEventBoard } from "@/lib/odds-event-board-cache";

export const maxDuration = 30;

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

function families(selections: OddsSelection[]) {
  const markets = new Set(selections.map((selection) => selection.market));
  return {
    props: selections.filter((selection) => Boolean(selection.player)).length,
    alternates: selections.filter(
      (selection) =>
        !selection.player &&
        (selection.market === "Spread" || selection.market === "Total") &&
        !selection.featured,
    ).length,
    f3: [...markets].some((market) => market.startsWith("1st 3 Innings")),
    f5: [...markets].some((market) => market.startsWith("1st 5 Innings")),
    f7: [...markets].some((market) => market.startsWith("1st 7 Innings")),
    h1: [...markets].some((market) => market.startsWith("1st Half")),
    h2: [...markets].some((market) => market.startsWith("2nd Half")),
  };
}

/** Read-only one-time audit of the exact caches consumed by the pick maker. */
export async function GET() {
  const now = new Date();
  const today = easternDateKey(now);
  const sports = [];

  for (const sport of SPORTS) {
    const board = await loadCachedOddsBoard(sport);
    const events = board.events.filter(
      (event) => easternDateKey(new Date(event.commenceTime)) === today,
    );
    const rows = [];
    for (const event of events) {
      const detail = await loadCachedEventBoard(sport, event.id);
      rows.push({
        id: event.id,
        matchup: `${event.away} @ ${event.home}`,
        commenceTime: event.commenceTime,
        coreSelections: event.selections.length,
        detailSelections: detail.length,
        families: families(detail),
      });
    }
    sports.push({
      sport,
      boardSource: board.source,
      boardStale: board.stale,
      boardEvents: board.events.length,
      todayEvents: rows.length,
      rows,
    });
  }

  return NextResponse.json(
    { now: now.toISOString(), easternDate: today, sports },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
