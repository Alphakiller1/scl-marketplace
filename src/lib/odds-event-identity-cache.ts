import "server-only";

import type { OddsEvent } from "@/lib/odds-board";
import {
  legacyOddsEventIdentity,
  oddsEventIdentityFromBoard,
  oddsEventIdentityKey,
  parseOddsEventIdentity,
  type OddsEventIdentity,
} from "@/lib/odds-event-identity-contract";
import {
  readDurableOddsSnapshot,
  writeDurableOddsSnapshot,
} from "@/lib/odds-durable-cache";

/** Longer than the grader lookback and normal event/board retention. */
export const ODDS_EVENT_IDENTITY_RETENTION_SECONDS = 60 * 24 * 60 * 60;

/**
 * Archive immutable event identity separately from prices and selections.
 * A slate refresh may prune completed events, but their provider hash remains
 * resolvable to both opponents for two months.
 */
export async function archiveOddsEventIdentities(
  events: readonly OddsEvent[],
): Promise<void> {
  const savedAt = Date.now();
  await Promise.all(
    events.map((event) => {
      const identity = oddsEventIdentityFromBoard(event, savedAt);
      return writeDurableOddsSnapshot(
        oddsEventIdentityKey(identity.sport, identity.eventId),
        identity,
        savedAt,
        ODDS_EVENT_IDENTITY_RETENTION_SECONDS,
      );
    }),
  );
}

export async function loadOddsEventIdentity(
  sport: string,
  eventId: string,
): Promise<OddsEventIdentity | null> {
  const legacy = legacyOddsEventIdentity(sport, eventId);
  if (legacy) return legacy;
  return parseOddsEventIdentity(
    await readDurableOddsSnapshot(oddsEventIdentityKey(sport, eventId)),
    sport,
    eventId,
  );
}
