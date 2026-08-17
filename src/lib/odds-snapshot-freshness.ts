/**
 * Which of two cached snapshots to serve.
 *
 * The board is cached in two layers: Vercel's runtime cache (fast, ephemeral,
 * REGIONAL) in front of a durable Postgres snapshot. The read used to return
 * the runtime value whenever it merely parsed, which silently masks a newer
 * durable snapshot — and the two layers drift apart routinely, because the
 * runtime cache is per-region and evicts on its own schedule while the database
 * row is written once and shared.
 *
 * The failure is invisible and sport-specific: one region serves a board hours
 * older than the database has, another serves the fresh one, and both report
 * themselves as cache hits. It is also unrecoverable from outside the app —
 * nothing in the codebase ever invalidates the `odds-board` tag, and the
 * entries carry a 30-day TTL, so a region that cached an empty board keeps
 * serving it long after the database has real games.
 *
 * Recency is the only sound tiebreak: both layers hold the same shape, and the
 * snapshot with the later `savedAt` is by definition the closer one to what the
 * books are showing.
 *
 * Pure — no network, no server-only, unit-testable.
 */

export type SavedAtSnapshot = { savedAt: number };

/**
 * The newer of a runtime and a durable snapshot, or whichever exists.
 *
 * Ties go to the runtime value: identical `savedAt` means they are the same
 * write, and preferring the in-memory copy avoids a pointless swap.
 */
export function freshestSnapshot<T extends SavedAtSnapshot>(
  runtime: T | null | undefined,
  durable: T | null | undefined,
): T | null {
  if (!runtime) return durable ?? null;
  if (!durable) return runtime;
  return durable.savedAt > runtime.savedAt ? durable : runtime;
}
