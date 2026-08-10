import { NextResponse } from "next/server";

import {
  fetchUpcomingOdds,
  logOddsUsage,
  resolveOddsApiSport,
} from "@/lib/odds-api";
import {
  loadCachedOddsBoard,
  storeOddsBoardEvents,
} from "@/lib/odds-board-cache";
import { normalizeEventBoard, type OddsSelection } from "@/lib/odds-board";
import {
  loadCachedEventBoard,
  storeEventBoardSelections,
} from "@/lib/odds-event-board-cache";
import { expandedBoardMarkets, type RawEventOdds } from "@/lib/odds-verify";

export const maxDuration = 60;

const SPORTS = ["MLB", "WNBA"] as const;
const CORE_BOARD_CREDIT_COST = 3;
// The provider bills these bundled event requests at the observed per-call
// cost, which is lower than the raw market-key count for alternate families.
const DETAIL_CREDIT_COST = { MLB: 23, WNBA: 12 } as const;
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

function easternDateParts(date: Date) {
  return Object.fromEntries(
    EASTERN_DATE.formatToParts(date).map((part) => [part.type, part.value]),
  );
}

function easternDateKey(date: Date): string {
  const parts = easternDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function tomorrowEasternDateKey(now: Date): string {
  const parts = easternDateParts(now);
  return new Date(
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day) + 1,
    ),
  )
    .toISOString()
    .slice(0, 10);
}

function requiredMarkets(sport: SupportedSport): string[] {
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

function alreadyFilled(sport: SupportedSport, selections: OddsSelection[]) {
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

async function listTomorrowsEvents(
  sport: SupportedSport,
  apiKey: string,
  now: Date,
) {
  const apiSport = resolveOddsApiSport(sport);
  if (!apiSport) return { events: [], remaining: 0 };
  const response = await fetch(
    `https://api.the-odds-api.com/v4/sports/${apiSport}/events/?apiKey=${encodeURIComponent(apiKey)}&dateFormat=iso`,
    { cache: "no-store" },
  );
  logOddsUsage(
    response,
    `authorized tomorrow event list ${sport}`,
    "board",
    sport,
  );
  if (!response.ok) return { events: [], remaining: 0 };
  const targetDate = tomorrowEasternDateKey(now);
  const events = ((await response.json()) as ProviderEvent[]).filter(
    (event) => {
      const startsAt = new Date(event.commence_time);
      return (
        startsAt.getTime() > now.getTime() &&
        easternDateKey(startsAt) === targetDate
      );
    },
  );
  return {
    events,
    remaining: Number(response.headers.get("x-requests-remaining") ?? 0),
  };
}

/** One owner-authorized, quota-checked fill for tomorrow's complete slate. */
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
      ...(await listTomorrowsEvents(sport, apiKey, now)),
    })),
  );
  const events = listed.flatMap(({ sport, events: sportEvents }) =>
    sportEvents.map((event) => ({ sport, event })),
  );

  const cachedDetails = new Map<string, OddsSelection[]>();
  for (const { sport, event } of events) {
    cachedDetails.set(
      `${sport}:${event.id}`,
      await loadCachedEventBoard(sport, event.id),
    );
  }
  const missingDetails = events.filter(
    ({ sport, event }) =>
      !alreadyFilled(sport, cachedDetails.get(`${sport}:${event.id}`) ?? []),
  );

  const coreBoards = await Promise.all(
    SPORTS.map(async (sport) => ({
      sport,
      board: await loadCachedOddsBoard(sport),
    })),
  );
  const missingCoreSports = coreBoards
    .filter(({ sport, board }) => {
      const requiredIds = new Set(
        events
          .filter((candidate) => candidate.sport === sport)
          .map(({ event }) => event.id),
      );
      return [...requiredIds].some(
        (eventId) => !board.events.some((event) => event.id === eventId),
      );
    })
    .map(({ sport }) => sport);

  const estimatedCredits =
    missingDetails.reduce(
      (sum, { sport }) => sum + DETAIL_CREDIT_COST[sport],
      0,
    ) +
    missingCoreSports.length * CORE_BOARD_CREDIT_COST;
  const availableCredits = Math.min(
    ...listed.map(({ remaining }) => remaining),
  );
  if (estimatedCredits > availableCredits) {
    return NextResponse.json(
      {
        error: "Insufficient provider credits for an all-or-nothing fill",
        date: tomorrowEasternDateKey(now),
        listedEvents: events.length,
        missingDetailEvents: missingDetails.length,
        missingCoreSports,
        estimatedCredits,
        availableCredits,
      },
      { status: 409 },
    );
  }

  const coreResults: Record<string, unknown>[] = [];
  for (const sport of SPORTS) {
    if (!missingCoreSports.includes(sport)) {
      coreResults.push({ sport, status: "cached" });
      continue;
    }
    const boardEvents = await fetchUpcomingOdds(sport, {
      apiKeyOverride: apiKey,
    });
    const stored = await storeOddsBoardEvents(sport, boardEvents);
    const requiredIds = events
      .filter((candidate) => candidate.sport === sport)
      .map(({ event }) => event.id);
    const missingIds = requiredIds.filter(
      (eventId) => !stored.events.some((event) => event.id === eventId),
    );
    coreResults.push({
      sport,
      status: missingIds.length === 0 ? "filled" : "incomplete",
      events: stored.events.length,
      missingIds,
    });
  }

  const results: Record<string, unknown>[] = [];
  for (const { sport, event } of events) {
    const cached = cachedDetails.get(`${sport}:${event.id}`) ?? [];
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
    logOddsUsage(response, `authorized tomorrow ${event.id}`, "board", sport);
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
      status: alreadyFilled(sport, selections) ? "filled" : "incomplete",
      selections: selections.length,
      requestedMarkets: markets.length,
      families: selectionFamilies(selections),
    });
  }

  return NextResponse.json(
    {
      date: tomorrowEasternDateKey(now),
      listedEvents: events.length,
      estimatedCredits,
      availableCredits,
      coreResults,
      cachedEvents: results.filter((result) => result.status === "cached")
        .length,
      filledEvents: results.filter((result) => result.status === "filled")
        .length,
      incompleteEvents: results.filter(
        (result) => result.status === "incomplete",
      ).length,
      failedEvents: results.filter((result) =>
        String(result.status).startsWith("provider_"),
      ).length,
      results,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
