/**
 * Which day a position belongs to — the slate day, not the day it was logged.
 *
 * An owner compared a capper's 1D leaderboard line (6-12, +30.99U) against his
 * pick history (5 plays) and reasonably concluded one of them was wrong. Neither
 * was. The leaderboard's 1D window keys on **event start** — the games played
 * yesterday — while the history listed picks by **`createdAt`**, the ones logged
 * yesterday. For a capper who logs days ahead and runs parlays, those are almost
 * disjoint sets; for one who logs same-day straights they coincide exactly, which
 * is why only some cappers looked broken.
 *
 * This is the single definition both surfaces read, and it deliberately mirrors
 * `leaderboardParlayDateFilter`:
 *
 *   - A straight play belongs to its event start, falling back to log time. That
 *     fallback carries real weight: **51% of Play rows have no `eventStartsAt`**
 *     (the legacy import), so treating a null as "no date" would bury half of
 *     every capper's history.
 *   - A parlay belongs to the day its **last** bound leg was played — a ticket is
 *     decided when its final game finishes. Not the earliest leg, which is what
 *     `ParlayView.eventStartsAt` carries for the lifecycle chip; sorting on that
 *     would re-introduce the same mismatch one day earlier.
 *   - A parlay with no bound legs falls back to log time.
 */

/** Slate date for a straight play. */
export function slateDateForPlay(
  eventStartsAt: Date | null | undefined,
  createdAt: Date,
): Date {
  return eventStartsAt ?? createdAt;
}

/**
 * Slate date for a parlay: its last bound leg, else log time.
 *
 * Matches the leaderboard's 1D rule, so a ticket lands on the same day in the
 * history as it does in the ranking.
 */
export function slateDateForParlay(
  legEventStarts: readonly (Date | null | undefined)[],
  createdAt: Date,
): Date {
  let latest: Date | null = null;
  for (const start of legEventStarts) {
    if (!start) continue;
    if (!latest || start.getTime() > latest.getTime()) latest = start;
  }
  return latest ?? createdAt;
}
