import type { LegacyRecordScope } from "@prisma/client";

import { LEGACY_RECORD_ALL_SPORTS } from "@/lib/schemas/legacy-records.schema";
import type { StatsBaseline } from "@/lib/stats";

/**
 * Scopes that make up a legacy capper's all-time carried record.
 *
 * `PRE_IMPORT` is the current calendar year minus the ~90 days of picks that
 * were imported as real `Play` rows. Prior complete years (`YEAR_2025`,
 * `YEAR_2024`) live in the same table but do not overlap those plays — the
 * mid-2026 export's pick rows all fall in 2026-04-18..2026-07-29.
 *
 * Trailing windows, seasons, and `CURRENT_YEAR` are excluded from the
 * headline: they overlap `PRE_IMPORT` and/or the imported receipts, and
 * folding them would double-count. The by-sport table reads `CURRENT_YEAR`
 * instead of `PRE_IMPORT` so it matches the old site's own counters.
 */
export const ALL_TIME_LEGACY_SCOPES: LegacyRecordScope[] = [
  "PRE_IMPORT",
  "YEAR_2025",
  "YEAR_2024",
];

/**
 * Scopes the career-by-sport table reads. `CURRENT_YEAR` is the old site's
 * year-to-date page (imported slips already inside). Prior years sit beside
 * it. `PRE_IMPORT` is the headline residual and is not a sport breakdown.
 */
export const SPORT_TABLE_LEGACY_SCOPES: LegacyRecordScope[] = [
  "CURRENT_YEAR",
  "YEAR_2025",
  "YEAR_2024",
];

/** Headline carry plus the year snapshot the sport table needs. */
export const PROFILE_LEGACY_SCOPES: LegacyRecordScope[] = [
  "PRE_IMPORT",
  "CURRENT_YEAR",
  "YEAR_2025",
  "YEAR_2024",
];

export const allTimeLegacyRecordWhere: {
  scope: { in: LegacyRecordScope[] };
} = {
  scope: { in: ALL_TIME_LEGACY_SCOPES },
};

export const sportTableLegacyRecordWhere: {
  scope: { in: LegacyRecordScope[] };
} = {
  scope: { in: SPORT_TABLE_LEGACY_SCOPES },
};

export const profileLegacyRecordWhere: {
  scope: { in: LegacyRecordScope[] };
} = {
  scope: { in: PROFILE_LEGACY_SCOPES },
};

const ALL_TIME_SCOPE_SET = new Set<LegacyRecordScope>(ALL_TIME_LEGACY_SCOPES);

export function getAllTimeLegacyBaseline(
  rows: Array<{
    scope: LegacyRecordScope;
    sport?: string;
    wins: number;
    losses: number;
    pushes: number;
    unitsRisked: unknown;
    unitsNet: unknown;
  }>,
): StatsBaseline | null {
  return statsBaselineFromLegacyRows(
    rows.filter(
      (row) =>
        ALL_TIME_SCOPE_SET.has(row.scope) &&
        (row.sport ?? LEGACY_RECORD_ALL_SPORTS) === LEGACY_RECORD_ALL_SPORTS,
    ),
  );
}

/**
 * The old site's own year-to-date total.
 *
 * `CURRENT_YEAR` already contains the imported pick rows, so any caller folding
 * this into a YTD figure must drop the plays logged at or before
 * `legacySnapshotCapturedAt` or it counts that overlap twice.
 */
export function getYtdLegacyBaseline(
  rows: Array<{
    scope: LegacyRecordScope;
    sport?: string;
    wins: number;
    losses: number;
    pushes: number;
    unitsRisked: unknown;
    unitsNet: unknown;
  }>,
): StatsBaseline | null {
  return statsBaselineFromLegacyRows(
    rows.filter(
      (row) =>
        row.scope === "CURRENT_YEAR" &&
        (row.sport ?? LEGACY_RECORD_ALL_SPORTS) === LEGACY_RECORD_ALL_SPORTS,
    ),
  );
}

/** Export instant on the current-year snapshot — imported slips sit at or before this. */
export function legacySnapshotCapturedAt(
  rows: Array<{
    scope?: LegacyRecordScope | string;
    capturedAt?: Date | null;
  }>,
): Date | null {
  let latest = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    if (row.scope != null && row.scope !== "CURRENT_YEAR") continue;
    const time = row.capturedAt?.getTime();
    if (time == null) continue;
    if (time > latest) latest = time;
  }
  return Number.isFinite(latest) ? new Date(latest) : null;
}

export type LegacyAggregateRow = {
  sport?: string;
  wins: number;
  losses: number;
  pushes: number;
  unitsRisked: number;
  unitsNet: number;
};

function addRow(target: LegacyAggregateRow, row: LegacyAggregateRow): void {
  target.wins += row.wins;
  target.losses += row.losses;
  target.pushes += row.pushes;
  target.unitsRisked += row.unitsRisked;
  target.unitsNet += row.unitsNet;
}

export function normalizeLegacyAggregateRow(row: {
  sport?: string;
  wins: number;
  losses: number;
  pushes: number;
  unitsRisked: unknown;
  unitsNet: unknown;
}): LegacyAggregateRow {
  return {
    sport: row.sport,
    wins: row.wins,
    losses: row.losses,
    pushes: row.pushes,
    unitsRisked: Number(row.unitsRisked),
    unitsNet: Number(row.unitsNet),
  };
}

/** Collapse same-sport rows from different all-time scopes into one line. */
export function collapseLegacyRecordsBySport(
  rows: LegacyAggregateRow[],
): LegacyAggregateRow[] {
  const bySport = new Map<string, LegacyAggregateRow>();
  for (const row of rows) {
    const sport = row.sport ?? LEGACY_RECORD_ALL_SPORTS;
    const current = bySport.get(sport);
    if (!current) {
      bySport.set(sport, { ...row, sport });
      continue;
    }
    addRow(current, row);
  }
  return [...bySport.values()];
}

export function statsBaselineFromLegacyRows(
  rows: Array<{
    wins: number;
    losses: number;
    pushes: number;
    unitsRisked: unknown;
    unitsNet: unknown;
  }>,
): StatsBaseline | null {
  if (rows.length === 0) return null;
  let wins = 0;
  let losses = 0;
  let pushes = 0;
  let stakedUnits = 0;
  let units = 0;
  for (const row of rows) {
    wins += row.wins;
    losses += row.losses;
    pushes += row.pushes;
    stakedUnits += Number(row.unitsRisked);
    units += Number(row.unitsNet);
  }
  if (wins + losses + pushes === 0) return null;
  return { wins, losses, pushes, stakedUnits, units };
}

export function carriedResultsFromLegacyRows(
  rows: Array<{ wins: number; losses: number; pushes: number }>,
): number {
  return rows.reduce(
    (total, row) => total + row.wins + row.losses + row.pushes,
    0,
  );
}

/**
 * Career sample used by maturity meters.
 *
 * All-time `computeCapperStats` already folds the carry into `settled`. Adding
 * `carriedResults` again was the 1,118 → 1,668 inflation on public profiles
 * (getPublicCapperEvidenceByIds never passed a play-lifetime map). Windowed
 * boards pass the unwindowed play count so carry still counts toward career.
 */
export function lifetimeGradedSample({
  windowSettled,
  carriedResults,
  playLifetime,
  applyBaseline,
}: {
  windowSettled: number;
  carriedResults: number;
  playLifetime?: number;
  applyBaseline: boolean;
}): number {
  if (playLifetime != null) {
    return playLifetime + carriedResults;
  }
  if (applyBaseline) return windowSettled;
  return windowSettled + carriedResults;
}
