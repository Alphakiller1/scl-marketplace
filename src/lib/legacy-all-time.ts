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
 * Trailing windows, seasons, and `CURRENT_YEAR` are excluded: they overlap
 * `PRE_IMPORT` and/or the imported receipts, and folding them would
 * double-count. One capper still carries ~60 of those overlapping rows.
 */
export const ALL_TIME_LEGACY_SCOPES: LegacyRecordScope[] = [
  "PRE_IMPORT",
  "YEAR_2025",
  "YEAR_2024",
];

export const allTimeLegacyRecordWhere: {
  scope: { in: LegacyRecordScope[] };
} = {
  scope: { in: ALL_TIME_LEGACY_SCOPES },
};

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
