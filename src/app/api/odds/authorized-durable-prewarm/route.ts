import { NextResponse } from "next/server";

import {
  fetchUpcomingOdds,
  logOddsUsage,
  resolveOddsApiSport,
} from "@/lib/odds-api";
import { normalizeEventBoard, type OddsSelection } from "@/lib/odds-board";
import { storeOddsBoardEvents } from "@/lib/odds-board-cache";
import { storeEventBoardSelections } from "@/lib/odds-event-board-cache";
import { expandedBoardMarkets, type RawEventOdds } from "@/lib/odds-verify";

export const maxDuration = 60;

const SPORTS = ["WNBA", "MLB"] as const;
const EASTERN_DATE = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

type SupportedSport = (typeof SPORTS)[number];
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

function requiredMarkets(sport: SupportedSport): string[] {
  return expandedBoardMarkets(sport).filter(
    (market) => market !== "team_totals" && market !== "alternate_team_totals",
  );
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

async function listTodaysEvents(
  sport: SupportedSport,
  apiKey: string,
  now: Date,
) {
  const apiSport = resolveOddsApiSport(sport);
  if (!apiSport) return [];
  const response = await fetch(
    `https://api.the-odds-api.com/v4/sports/${apiSport}/events/?apiKey=${encodeURIComponent(apiKey)}&dateFormat=iso`,
    { cache: "no-store" },
  );
  logOddsUsage(response, `durable event list ${sport}`, "board", sport);
  if (!response.ok) return [];
  const today = easternDateKey(now);
  return ((await response.json()) as ProviderEvent[])
    .filter((event) => {
      const startsAt = new Date(event.commence_time);
      return (
        startsAt.getTime() > now.getTime() && easternDateKey(startsAt) === today
      );
    })
    .sort(
      (left, right) =>
        Date.parse(left.commence_time) - Date.parse(right.commence_time),
    );
}

/** One owner-authorized fill into deployment-independent PostgreSQL storage. */
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
      events: await listTodaysEvents(sport, apiKey, now),
    })),
  );

  const coreResults = [];
  for (const sport of SPORTS) {
    const events = await fetchUpcomingOdds(sport, { apiKeyOverride: apiKey });
    const stored = await storeOddsBoardEvents(sport, events);
    const todayIds = listed
      .find((entry) => entry.sport === sport)
      ?.events.map((event) => event.id);
    coreResults.push({
      sport,
      events: stored.events.length,
      missingIds: (todayIds ?? []).filter(
        (id) => !stored.events.some((event) => event.id === id),
      ),
    });
  }

  const results = [];
  for (const { sport, events } of listed) {
    for (const event of events) {
      const apiSport = resolveOddsApiSport(sport);
      const markets = requiredMarkets(sport);
      const response = await fetch(
        `https://api.the-odds-api.com/v4/sports/${apiSport}/events/${event.id}/odds/?apiKey=${encodeURIComponent(apiKey)}&regions=us&markets=${encodeURIComponent(markets.join(","))}&oddsFormat=american`,
        { cache: "no-store" },
      );
      logOddsUsage(response, `durable event ${event.id}`, "board", sport);
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
        families: families(selections),
      });
    }
  }

  return NextResponse.json(
    {
      date: easternDateKey(now),
      listedEvents: listed.reduce(
        (total, entry) => total + entry.events.length,
        0,
      ),
      coreResults,
      filledEvents: results.filter((result) => result.status === "filled")
        .length,
      failedEvents: results.filter((result) =>
        result.status.startsWith("provider_"),
      ).length,
      results,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
