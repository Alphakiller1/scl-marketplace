import { NextResponse } from "next/server";

import { getCapperBooks } from "@/lib/capper-books";
import { buildOddsBoardMeta, oddsApiKey } from "@/lib/odds-api";
import { loadCachedOddsBoard, loadOddsBoard } from "@/lib/odds-board-cache";
import { dedupeOddsEvents, sortByKickoff } from "@/lib/odds-board";
import { selectionAllowedForMarkets } from "@/lib/odds-control";
import { getManagedOddsSportControl } from "@/lib/odds-control-runtime";
import { ODDS_BOARD_SPORTS } from "@/lib/game-picker";
import { getCurrentUser } from "@/lib/session";

/**
 * Odds-assist feed for the play-entry form. Server-side so ODDS_API_KEY never
 * reaches the browser. Returns [] when the key/sport is unavailable.
 * GET /api/odds?sport=NBA
 */
export async function GET(request: Request) {
  const startedAt = Date.now();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const requestedSport =
    new URL(request.url).searchParams.get("sport")?.toUpperCase() ?? "";
  const books = await getCapperBooks(user.id);
  const configured = Boolean(oddsApiKey());
  const sports =
    requestedSport === "ALL"
      ? ODDS_BOARD_SPORTS.map((sport) => sport.key)
      : [requestedSport];
  let policies: Awaited<ReturnType<typeof getManagedOddsSportControl>>[];
  try {
    policies = await Promise.all(
      sports.map((sport) => getManagedOddsSportControl(sport)),
    );
  } catch (error) {
    console.error("[odds-board] owner controls unavailable", error);
    return NextResponse.json(
      { error: "Odds controls are temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const boards = configured
    ? await Promise.all(
        sports.map((sport, index) => {
          const policy = policies[index];
          if (policy && (!policy.enabled || !policy.surfaceEnabled))
            return null;
          return policy ? loadCachedOddsBoard(sport) : loadOddsBoard(sport);
        }),
      )
    : [];
  const events = sortByKickoff(
    dedupeOddsEvents(
      boards.flatMap((board, index) => {
        if (!board) return [];
        const policy = policies[index];
        if (!policy) return board.events;
        return board.events
          .filter(
            (event) =>
              policy.leagues.length === 0 ||
              !event.league ||
              policy.leagues.includes(event.league),
          )
          .map((event) => ({
            ...event,
            selections: event.selections.filter((selection) =>
              selectionAllowedForMarkets(selection, policy.surfaceMarkets),
            ),
          }))
          .filter((event) => event.selections.length > 0);
      }),
    ),
  );
  const stale = boards.some((board) => board?.stale);
  const circuitBreak = boards.some(
    (board) =>
      board?.source === "stale_circuit_break" ||
      board?.source === "circuit_break_empty",
  );
  const baseMeta = buildOddsBoardMeta(requestedSport, events.length, {
    configured,
    circuitBreak,
  });
  const meta = {
    ...baseMeta,
    ...(stale && events.length > 0 ? { warning: "stale_cache" } : {}),
    stale,
    sources: Object.fromEntries(
      sports.map((sport, index) => [
        sport,
        boards[index]?.source ?? "disabled",
      ]),
    ),
  };

  const logContext = {
    sport: requestedSport,
    eventCount: events.length,
    warning: meta.warning ?? null,
    circuitBreak,
    stale,
    sources: meta.sources,
    durationMs: Date.now() - startedAt,
  };
  if (meta.warning && meta.warning !== "no_upcoming_events") {
    console.warn("[odds-board] degraded", logContext);
  } else {
    console.info("[odds-board] completed", logContext);
  }

  return NextResponse.json(
    { events, configured, books, meta },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
