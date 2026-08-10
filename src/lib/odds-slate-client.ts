import type { OddsEvent } from "@/lib/odds-board";

export type OddsSlatePayload = {
  events: OddsEvent[];
  configured: boolean;
  books: string[];
  meta?: {
    warning?: string;
    stale?: boolean;
  };
};

const CLIENT_SLATE_TTL_MS = 5 * 60 * 1_000;

let cached: { payload: OddsSlatePayload; savedAt: number } | null = null;
let inFlight: Promise<OddsSlatePayload> | null = null;

function validPayload(value: unknown): value is OddsSlatePayload {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return Array.isArray(row.events) && Array.isArray(row.books);
}

/** One request for the slate, reused across receipt -> selection remounts. */
export async function loadOddsSlate(
  fetchImpl: typeof fetch = fetch,
): Promise<OddsSlatePayload> {
  if (cached && Date.now() - cached.savedAt <= CLIENT_SLATE_TTL_MS) {
    return cached.payload;
  }
  if (inFlight) return inFlight;

  inFlight = fetchImpl("/api/odds?sport=ALL", {
    signal: AbortSignal.timeout(20_000),
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Odds slate request failed: ${response.status}`);
      }
      const payload: unknown = await response.json();
      if (!validPayload(payload)) {
        throw new Error("Odds slate response was malformed");
      }
      // Never pin a circuit-breaker empty response in the browser.
      if (
        payload.events.length > 0 ||
        payload.meta?.warning === "no_upcoming_events"
      ) {
        cached = { payload, savedAt: Date.now() };
      }
      return payload;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Test-only reset for deterministic remount coverage. */
export function resetOddsSlateClientCache(): void {
  cached = null;
  inFlight = null;
}
