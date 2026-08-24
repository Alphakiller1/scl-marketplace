import type { Outcome, VerificationTier } from "@prisma/client";

import type { PlayView } from "@/lib/queries/plays";

/**
 * The public profile ledger reads two tables, not one.
 *
 * A capper's positions of record are straight plays **and** whole parlays —
 * that is what the leaderboard record, the Evidence Brief units, and the
 * cumulative chart all aggregate. The Pick History only ever read `Play` rows
 * with `parlayId: null`, so a parlay-only capper's profile went silent while
 * their record kept moving (@wisegentlemensports_parlay: every position since
 * 2026-08-07 is a parlay, and the ledger's last row was 2026-08-04).
 *
 * These helpers are the pure half of that merge: entry shape, ordering, the
 * batch watermark, and the composite cursor. The database reads live in
 * `src/lib/queries/capper.ts`.
 */

/** A parlay leg as shown publicly — never a position of record on its own. */
export type PublicParlayLegView = {
  id: string;
  sport: string;
  league: string | null;
  market: string;
  selection: string;
  oddsAmerican: number;
  side: string | null;
  book: string | null;
  eventLabel: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  eventStartsAt: Date | null;
};

/** A capper's parlay as one public position of record, with its legs. */
export type PublicParlayView = {
  id: string;
  combinedOddsAmerican: number | null;
  units: number;
  outcome: Outcome;
  profitUnits: number | null;
  createdAt: Date;
  /** Verified only when every leg was board-verified. */
  verificationTier: VerificationTier;
  /** Earliest leg start — drives the lifecycle chip and the embargo clock. */
  eventStartsAt: Date | null;
  legs: PublicParlayLegView[];
  isEmbargoed?: boolean;
  embargoedUntil?: Date | null;
};

/** One row of the public Pick History: a straight play or a whole parlay. */
export type ProfileHistoryEntry =
  | ({ kind: "play" } & PlayView)
  | ({ kind: "parlay" } & PublicParlayView);

/** Keyset position in the merged ledger — `createdAt` desc, then `id` desc. */
export type ProfileHistoryKey = { createdAt: Date; id: string };

/** Negative when `a` is newer, matching `orderBy: [createdAt desc, id desc]`. */
export function compareHistoryKeysDesc(
  a: ProfileHistoryKey,
  b: ProfileHistoryKey,
): number {
  const byTime = b.createdAt.getTime() - a.createdAt.getTime();
  if (byTime !== 0) return byTime;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

/** Straight plays + parlays as one most-recent-first list (pure; no DB). */
export function mergeHistoryEntries(
  plays: ({ kind: "play" } & PlayView)[],
  parlays: ({ kind: "parlay" } & PublicParlayView)[],
): ProfileHistoryEntry[] {
  return [...plays, ...parlays].sort(compareHistoryKeysDesc);
}

/**
 * How deep a two-stream batch may be trusted.
 *
 * Each table is read with its own `take`, so when a stream comes back full the
 * rows below its tail were never fetched. Cutting the merged batch at the
 * newest full stream's tail keeps every entry that is provably complete and
 * leaves the rest for the next batch. Returns null when both streams were
 * exhausted — the whole merge is then complete.
 */
export function historyBatchWatermark(streams: {
  playTail: ProfileHistoryKey | null;
  playFull: boolean;
  parlayTail: ProfileHistoryKey | null;
  parlayFull: boolean;
}): ProfileHistoryKey | null {
  let cut: ProfileHistoryKey | null = null;
  if (streams.playFull && streams.playTail) cut = streams.playTail;
  if (
    streams.parlayFull &&
    streams.parlayTail &&
    (!cut || compareHistoryKeysDesc(streams.parlayTail, cut) < 0)
  ) {
    cut = streams.parlayTail;
  }
  return cut;
}

/** The merged entries at or above the watermark (all of them when null). */
export function entriesThroughWatermark(
  entries: ProfileHistoryEntry[],
  watermark: ProfileHistoryKey | null,
): ProfileHistoryEntry[] {
  if (!watermark) return entries;
  return entries.filter(
    (entry) => compareHistoryKeysDesc(entry, watermark) <= 0,
  );
}

const CURSOR_SEPARATOR = "~";

/**
 * Composite cursor, because a bare row id cannot address two tables.
 *
 * `<createdAt ISO>~<id>` resumes the merged stream from an exact keyset
 * position in either table.
 */
export function encodeHistoryCursor(key: ProfileHistoryKey): string {
  return `${key.createdAt.toISOString()}${CURSOR_SEPARATOR}${key.id}`;
}

/**
 * Parse a composite cursor. Returns null for the legacy bare-play-id cursors a
 * page rendered before this shipped still holds — the caller resolves those
 * against the database instead of dropping the reader's place in the ledger.
 */
export function decodeHistoryCursor(
  cursor: string | null | undefined,
): ProfileHistoryKey | null {
  if (!cursor) return null;
  const separator = cursor.indexOf(CURSOR_SEPARATOR);
  if (separator <= 0) return null;
  const createdAt = new Date(cursor.slice(0, separator));
  const id = cursor.slice(separator + 1);
  if (!id || Number.isNaN(createdAt.getTime())) return null;
  return { createdAt, id };
}
