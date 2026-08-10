import { NextResponse } from "next/server";

import { logOddsUsage, resolveOddsApiSport } from "@/lib/odds-api";
import { normalizeEventBoard, type OddsSelection } from "@/lib/odds-board";
import {
  loadCachedEventBoard,
  storeEventBoardSelections,
} from "@/lib/odds-event-board-cache";
import { expandedBoardMarkets, type RawEventOdds } from "@/lib/odds-verify";

export const maxDuration = 60;

const SPORTS = ["MLB", "WNBA"] as const;
const EASTERN_DATE = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

type ProviderEvent = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
};

function easternDateKey(date: Date): string {
  const parts = Object.fromEntries(
    EASTERN_DATE.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function requiredMarkets(sport: (typeof SPORTS)[number]): string[] {
  return expandedBoardMarkets(sport).filter(
    (market) => market !== "team_totals" && market !== "alternate_team_totals",
  );
}

function selectionFamilies(selections: OddsSelection[]) {
  const markets = new Set(selections.map((selection) => selection.market));
  return {
    props: selections.filter((selection) => Boolean(selection.player)).length,
    fullGameAlternates: selections.filter(
      (selection) =>
        !selection.player &&
        (selection.market === "Spread" || selection.market === "Total"),
    ).length,
    f3: [...markets].some((market) => market.startsWith("1st 3 Innings")),
    f5: [...markets].some((market) => market.startsWith("1st 5 Innings")),
    f7: [...markets].some((market) => market.startsWith("1st 7 Innings")),
    h1: [...markets].some((market) => market.startsWith("1st Half")),
    h2: [...markets].some((market) => market.startsWith("2nd Half")),
  };
}

function alreadyFilled(
  sport: (typeof SPORTS)[number],
  selections: OddsSelection[],
) {
  if (selections.length < 100) return false;
  const families = selectionFamilies(selections);
  if (sport === "MLB") {
    return (
      families.props > 0 &&
      families.fullGameAlternates > 0 &&
      families.f3 &&
      families.f5 &&
      families.f7
    );
  }
  return (
    families.props > 0 &&
    families.fullGameAlternates > 0 &&
    families.h1 &&
    families.h2
  );
}

async function listTodaysPregameEvents(
  sport: (typeof SPORTS)[number],
  apiKey: string,
  now: Date,
) {
  const apiSport = resolveOddsApiSport(sport);
  if (!apiSport) return [];
  const response = await fetch(
    `https://api.the-odds-api.com/v4/sports/${apiSport}/events/?apiKey=${encodeURIComponent(apiKey)}&dateFormat=iso`,
    { cache: "no-store" },
  );
  logOddsUsage(response, `authorized event list ${sport}`, "board", sport);
  if (!response.ok) return [];
  const today = easternDateKey(now);
  return ((await response.json()) as ProviderEvent[]).filter((event) => {
    const startsAt = new Date(event.commence_time);
    return (
      startsAt.getTime() > now.getTime() && easternDateKey(startsAt) === today
    );
  });
}

/** One owner-authorized, key-in-header fill for today's missing expanded lines. */
export async function POST(request: Request) {
  const apiKey = request.headers.get("x-odds-api-key")?.trim();
  if (!apiKey || !/^[A-Za-z0-9_-]{20,200}$/.test(apiKey)) {
    return NextResponse.json(
      { error: "Missing provider key" },
      { status: 401 },
    );
  }

  const now = new Date();
  const listed = await Promise.all(
    SPORTS.map(async (sport) => ({
      sport,
      events: await listTodaysPregameEvents(sport, apiKey, now),
    })),
  );
  const events = listed.flatMap(({ sport, events }) =>
    events.map((event) => ({ sport, event })),
  );
  const results: Record<string, unknown>[] = [];

  for (const { sport, event } of events) {
    const cached = await loadCachedEventBoard(sport, event.id);
    if (alreadyFilled(sport, cached)) {
      results.push({
        sport,
        eventId: event.id,
        matchup: `${event.away_team} @ ${event.home_team}`,
        status: "cached",
        selections: cached.length,
        families: selectionFamilies(cached),
      });
      continue;
    }

    const apiSport = resolveOddsApiSport(sport);
    const markets = requiredMarkets(sport);
    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/${apiSport}/events/${event.id}/odds/?apiKey=${encodeURIComponent(apiKey)}&regions=us&markets=${encodeURIComponent(markets.join(","))}&oddsFormat=american`,
      { cache: "no-store" },
    );
    logOddsUsage(response, `authorized missing ${event.id}`, "board", sport);
    if (!response.ok) {
      results.push({
        sport,
        eventId: event.id,
        matchup: `${event.away_team} @ ${event.home_team}`,
        status: `provider_${response.status}`,
      });
      continue;
    }

    const selections = normalizeEventBoard(
      (await response.json()) as RawEventOdds,
    );
    if (selections.length > 0) {
      await storeEventBoardSelections(sport, event.id, selections);
    }
    results.push({
      sport,
      eventId: event.id,
      matchup: `${event.away_team} @ ${event.home_team}`,
      status: selections.length > 0 ? "filled" : "empty",
      selections: selections.length,
      requestedMarkets: markets.length,
      families: selectionFamilies(selections),
    });
  }

  return NextResponse.json(
    {
      date: easternDateKey(now),
      listedEvents: events.length,
      cachedEvents: results.filter((result) => result.status === "cached")
        .length,
      filledEvents: results.filter((result) => result.status === "filled")
        .length,
      failedEvents: results.filter((result) =>
        String(result.status).startsWith("provider_"),
      ).length,
      results,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
