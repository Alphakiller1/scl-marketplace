import "server-only";

import { getCache } from "@vercel/functions";

import { fetchEventBoard, getLastOddsApiRemaining } from "@/lib/odds-api";
import type { OddsSelection } from "@/lib/odds-board";
import { shouldCircuitBreak } from "@/lib/odds-budget";
import {
  readDurableOddsSnapshot,
  writeDurableOddsSnapshot,
} from "@/lib/odds-durable-cache";
import {
  mergeEventBoardSelections,
  parseEventBoardSnapshot,
  type EventBoardSnapshot,
} from "@/lib/odds-event-board-contract";

export const ODDS_EVENT_FRESH_SECONDS = 10 * 60;
export const ODDS_EVENT_RETENTION_SECONDS = 2 * 24 * 60 * 60;

export type LoadedEventBoard = {
  selections: OddsSelection[];
  source:
    | "provider"
    | "runtime_cache"
    | "stale_circuit_break"
    | "stale_provider_failure"
    | "circuit_break_empty"
    | "provider_empty";
  stale: boolean;
  savedAt: number | null;
};

const inFlight = new Map<string, Promise<LoadedEventBoard>>();

function cacheKey(sport: string, eventId: string): string {
  return `event-board:v1:${sport.toUpperCase()}:${eventId}`;
}

async function readSnapshot(
  sport: string,
  eventId: string,
): Promise<EventBoardSnapshot | null> {
  const key = cacheKey(sport, eventId);
  try {
    const value = await getCache({ namespace: "scl-odds" }).get(key);
    const snapshot = parseEventBoardSnapshot(value, sport, eventId);
    if (snapshot) return snapshot;
  } catch (error) {
    console.warn("[odds-event-cache] read failed", {
      sport,
      eventId,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
  return parseEventBoardSnapshot(
    await readDurableOddsSnapshot(key),
    sport,
    eventId,
  );
}

async function writeSnapshot(
  sport: string,
  eventId: string,
  selections: OddsSelection[],
): Promise<EventBoardSnapshot> {
  const snapshot: EventBoardSnapshot = {
    version: 1,
    sport: sport.toUpperCase(),
    eventId,
    selections,
    savedAt: Date.now(),
  };
  await writeDurableOddsSnapshot(
    cacheKey(sport, eventId),
    snapshot,
    snapshot.savedAt,
    ODDS_EVENT_RETENTION_SECONDS,
  );
  try {
    await getCache({ namespace: "scl-odds" }).set(
      cacheKey(sport, eventId),
      snapshot,
      {
        ttl: ODDS_EVENT_RETENTION_SECONDS,
        tags: ["odds-event-board", `odds-event-board:${eventId}`],
        name: `SCL ${sport.toUpperCase()} event board`,
      },
    );
  } catch (error) {
    console.warn("[odds-event-cache] write failed", {
      sport,
      eventId,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
  return snapshot;
}

/** Read an event snapshot without spending provider credits. */
export async function loadCachedEventBoard(
  sport: string,
  eventId: string,
): Promise<OddsSelection[]> {
  return (await readSnapshot(sport.toUpperCase(), eventId))?.selections ?? [];
}

async function refreshEventBoard(
  sport: string,
  eventId: string,
  cached: EventBoardSnapshot | null,
): Promise<LoadedEventBoard> {
  let selections: OddsSelection[] = [];
  try {
    selections = await fetchEventBoard(sport, eventId);
  } catch (error) {
    console.warn("[odds-event-cache] provider refresh failed", {
      sport,
      eventId,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
  if (selections.length > 0) {
    const merged = mergeEventBoardSelections(
      cached?.selections ?? [],
      selections,
    );
    const retainedCachedRows = merged.length > selections.length;
    const saved = await writeSnapshot(sport, eventId, merged);
    return {
      selections: merged,
      source: "provider",
      stale: retainedCachedRows,
      savedAt: saved.savedAt,
    };
  }
  if (cached) {
    return {
      selections: cached.selections,
      source: "stale_provider_failure",
      stale: true,
      savedAt: cached.savedAt,
    };
  }
  return {
    selections: [],
    source: "provider_empty",
    stale: false,
    savedAt: null,
  };
}

/** Shared last-good cache for props, period markets, and alternate event lines. */
export async function loadEventBoard(
  sport: string,
  eventId: string,
): Promise<LoadedEventBoard> {
  const normalizedSport = sport.toUpperCase();
  const key = cacheKey(normalizedSport, eventId);
  const cached = await readSnapshot(normalizedSport, eventId);
  const ageMs = cached ? Date.now() - cached.savedAt : Number.POSITIVE_INFINITY;

  if (cached && ageMs <= ODDS_EVENT_FRESH_SECONDS * 1_000) {
    return {
      selections: cached.selections,
      source: "runtime_cache",
      stale: false,
      savedAt: cached.savedAt,
    };
  }

  if (shouldCircuitBreak(getLastOddsApiRemaining())) {
    if (cached) {
      return {
        selections: cached.selections,
        source: "stale_circuit_break",
        stale: true,
        savedAt: cached.savedAt,
      };
    }
    return {
      selections: [],
      source: "circuit_break_empty",
      stale: false,
      savedAt: null,
    };
  }

  const existing = inFlight.get(key);
  if (existing) return existing;
  const pending = refreshEventBoard(normalizedSport, eventId, cached).finally(
    () => inFlight.delete(key),
  );
  inFlight.set(key, pending);
  return pending;
}
