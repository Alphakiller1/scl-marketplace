import type { LegacyPlayInput } from "@/lib/schemas/legacy-import.schema";

/**
 * Natural key for a legacy play, used to tell an already-imported play from a
 * genuinely new one.
 *
 * There is no legacy id stored on `Play` — the original import never populated
 * `sourceRef`, so imported rows cannot be matched back by identifier. What we
 * do have is determinism: `scripts/extract-legacy-mysql.py` derives `createdAt`
 * from the legacy row's `Rdate` + `Ltime` and nothing else, so re-extracting a
 * newer dump reproduces byte-identical timestamps for rows that were already
 * imported. That makes this composite an exact key rather than a heuristic
 * watermark, and it mirrors the extractor's own `dedupe_key`
 * (acct, Sport, Pick, Rdate, Value).
 *
 * `createdAt` is serialised to epoch milliseconds so a `Date` from Prisma and a
 * `Date` parsed from JSON compare equal.
 */
export type PlayKey = string;

export function playKey(p: {
  sport: string;
  selection: string;
  oddsAmerican: number;
  createdAt: Date | null | undefined;
}): PlayKey {
  const at = p.createdAt ? p.createdAt.getTime() : 0;
  // Selection is normalised because the extractor's `selection_for` collapses
  // whitespace inconsistently across legacy tables (MPicks vs past_plays).
  const selection = p.selection.trim().replace(/\s+/g, " ").toLowerCase();
  return `${p.sport}|${selection}|${p.oddsAmerican}|${at}`;
}

export type DeltaPlan = {
  /** Plays not present in the database at all. */
  insert: LegacyPlayInput[];
  /**
   * Plays already present as PENDING whose incoming copy has settled. The
   * legacy platform moves a pick from `active_plays` to `MPicks` when it
   * grades, so the same play legitimately arrives twice — once unsettled, once
   * with a result. Without this, a re-import would either duplicate it or leave
   * it stuck PENDING forever.
   */
  settle: Array<{ id: string; play: LegacyPlayInput }>;
  /** Already present and already settled — nothing to do. */
  unchanged: number;
};

export type ExistingPlay = {
  id: string;
  sport: string;
  selection: string;
  oddsAmerican: number;
  createdAt: Date;
  outcome: string;
};

/**
 * Diff one capper's incoming plays against what is already stored.
 *
 * Pure so it can be unit-tested without a database.
 */
export function planDelta(
  incoming: LegacyPlayInput[],
  existing: ExistingPlay[],
): DeltaPlan {
  const byKey = new Map<PlayKey, ExistingPlay>();
  for (const e of existing) byKey.set(playKey(e), e);

  const plan: DeltaPlan = { insert: [], settle: [], unchanged: 0 };
  // Guards against the same play appearing twice inside one export file.
  const seenThisRun = new Set<PlayKey>();

  for (const play of incoming) {
    const key = playKey({
      sport: play.sport,
      selection: play.selection,
      oddsAmerican: play.oddsAmerican,
      createdAt: play.createdAt ?? play.gradedAt ?? null,
    });
    if (seenThisRun.has(key)) continue;
    seenThisRun.add(key);

    const match = byKey.get(key);
    if (!match) {
      plan.insert.push(play);
    } else if (match.outcome === "PENDING" && play.outcome !== "PENDING") {
      plan.settle.push({ id: match.id, play });
    } else {
      plan.unchanged += 1;
    }
  }
  return plan;
}
