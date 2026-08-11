import "server-only";

import { getCache } from "@vercel/functions";

import { fetchUpcomingOdds, getLastOddsApiRemaining } from "@/lib/odds-api";
import type { OddsEvent } from "@/lib/odds-board";
import { shouldCircuitBreak } from "@/lib/odds-budget";
import {
  readDurableOddsSnapshot,
  writeDurableOddsSnapshot,
} from "@/lib/odds-durable-cache";

/**
 * Board prices are discovery data. Every submitted line is fetched again and
 * verified, so the discovery board can outlive the final recorded price.
 */
export const ODDS_BOARD_FRESH_SECONDS = 4 * 60 * 60;
export const ODDS_BOARD_RETENTION_SECONDS = 7 * 24 * 60 * 60;

type OddsBoardSnapshot = {
  version: 1;
  sport: string;
  events: OddsEvent[];
  savedAt: number;
};

export type OddsBoardSource =
  | "provider"
  | "runtime_cache"
  | "stale_cache_only"
  | "stale_circuit_break"
  | "stale_provider_failure"
  | "cache_empty"
  | "circuit_break_empty"
  | "provider_empty";

export type LoadedOddsBoard = {
  events: OddsEvent[];
  source: OddsBoardSource;
  savedAt: number | null;
  stale: boolean;
};

const inFlight = new Map<string, Promise<LoadedOddsBoard>>();

function cacheKey(sport: string): string {
  return `board:v1:${sport.toUpperCase()}`;
}

function isOddsEvent(value: unknown): value is OddsEvent {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.sport === "string" &&
    typeof row.commenceTime === "string" &&
    typeof row.home === "string" &&
    typeof row.away === "string" &&
    Array.isArray(row.selections)
  );
}

export function parseOddsBoardSnapshot(
  value: unknown,
  sport: string,
): OddsBoardSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    row.version !== 1 ||
    row.sport !== sport.toUpperCase() ||
    typeof row.savedAt !== "number" ||
    !Number.isFinite(row.savedAt) ||
    !Array.isArray(row.events) ||
    !row.events.every(isOddsEvent)
  ) {
    return null;
  }
  return row as OddsBoardSnapshot;
}

async function readSnapshot(sport: string): Promise<OddsBoardSnapshot | null> {
  const key = cacheKey(sport);
  try {
    const value = await getCache({ namespace: "scl-odds" }).get(key);
    const snapshot = parseOddsBoardSnapshot(value, sport);
    if (snapshot) return snapshot;
  } catch (error) {
    console.warn("[odds-board-cache] read failed", {
      sport,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
  return parseOddsBoardSnapshot(await readDurableOddsSnapshot(key), sport);
}

/** Read the shared board without spending provider credits. Used by health probes. */
export async function loadCachedOddsBoard(
  sport: string,
): Promise<LoadedOddsBoard> {
  const normalized = sport.toUpperCase();
  const cached = await readSnapshot(normalized);
  if (!cached) {
    return {
      events: [],
      source: "cache_empty",
      savedAt: null,
      stale: false,
    };
  }

  const stale = Date.now() - cached.savedAt > ODDS_BOARD_FRESH_SECONDS * 1_000;
  return {
    events: cached.events,
    source: stale ? "stale_cache_only" : "runtime_cache",
    savedAt: cached.savedAt,
    stale,
  };
}

async function writeSnapshot(
  sport: string,
  events: OddsEvent[],
): Promise<OddsBoardSnapshot> {
  const snapshot: OddsBoardSnapshot = {
    version: 1,
    sport: sport.toUpperCase(),
    events,
    savedAt: Date.now(),
  };
  await writeDurableOddsSnapshot(
    cacheKey(sport),
    snapshot,
    snapshot.savedAt,
    ODDS_BOARD_RETENTION_SECONDS,
  );
  try {
    await getCache({ namespace: "scl-odds" }).set(cacheKey(sport), snapshot, {
      ttl: ODDS_BOARD_RETENTION_SECONDS,
      tags: ["odds-board", `odds-board:${sport.toUpperCase()}`],
      name: `SCL ${sport.toUpperCase()} last-good board`,
    });
  } catch (error) {
    // Cache failure must not turn a healthy provider response into an empty UI.
    console.warn("[odds-board-cache] write failed", {
      sport,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
  return snapshot;
}

/** Persist an owner-authorized core board into both cache layers. */
export async function storeOddsBoardEvents(
  sport: string,
  events: OddsEvent[],
): Promise<LoadedOddsBoard> {
  const normalized = sport.toUpperCase();
  const saved = await writeSnapshot(normalized, events);
  return {
    events: saved.events,
    source: "provider",
    savedAt: saved.savedAt,
    stale: false,
  };
}

async function refreshBoard(
  sport: string,
  cached: OddsBoardSnapshot | null,
): Promise<LoadedOddsBoard> {
  const events = await fetchUpcomingOdds(sport);
  if (events.length > 0) {
    const saved = await writeSnapshot(sport, events);
    return {
      events,
      source: "provider",
      savedAt: saved.savedAt,
      stale: false,
    };
  }

  // A timeout, quota response, or transient empty payload must never erase the
  // last board that successfully contained selectable events.
  if (cached?.events.length) {
    return {
      events: cached.events,
      source: "stale_provider_failure",
      savedAt: cached.savedAt,
      stale: true,
    };
  }

  return {
    events: [],
    source: "provider_empty",
    savedAt: null,
    stale: false,
  };
}

/**
 * Shared board loader. A user or sportsbook list is deliberately absent from
 * the key: regions=us is common data and preferences are applied after load.
 */
export async function loadOddsBoard(sport: string): Promise<LoadedOddsBoard> {
  const normalized = sport.toUpperCase();
  const cached = await readSnapshot(normalized);
  const ageMs = cached ? Date.now() - cached.savedAt : Number.POSITIVE_INFINITY;

  if (cached && ageMs <= ODDS_BOARD_FRESH_SECONDS * 1_000) {
    return {
      events: cached.events,
      source: "runtime_cache",
      savedAt: cached.savedAt,
      stale: false,
    };
  }

  if (shouldCircuitBreak(getLastOddsApiRemaining())) {
    if (cached?.events.length) {
      return {
        events: cached.events,
        source: "stale_circuit_break",
        savedAt: cached.savedAt,
        stale: true,
      };
    }
    return {
      events: [],
      source: "circuit_break_empty",
      savedAt: null,
      stale: true,
    };
  }

  const existing = inFlight.get(normalized);
  if (existing) return existing;

  const pending = refreshBoard(normalized, cached).finally(() => {
    inFlight.delete(normalized);
  });
  inFlight.set(normalized, pending);
  return pending;
}
