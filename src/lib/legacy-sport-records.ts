import type { LegacyRecordScope } from "@prisma/client";

import { SPORTS, type SportKey } from "@/lib/constants";
import {
  SPORT_TABLE_LEGACY_SCOPES,
  legacySnapshotCapturedAt,
} from "@/lib/legacy-all-time";
import { LEGACY_RECORD_ALL_SPORTS } from "@/lib/schemas/legacy-records.schema";
import type { SportStats, StatsBaseline } from "@/lib/stats";

/** Unattributed current-year remainder when ALL ≠ sum of per-sport rows. */
export const CAREER_SPORT_OTHER = "OTHER";

/** Prior-year ALL with no (or incomplete) per-sport rows — not "Other". */
export const CAREER_SPORT_YEAR_2025 = "2025";
export const CAREER_SPORT_YEAR_2024 = "2024";

/** Parlay with no first-leg sport. */
export const CAREER_SPORT_MULTI = "MULTI";

const PRIOR_YEAR_BUCKETS: {
  scope: LegacyRecordScope;
  sport: string;
}[] = [
  { scope: "YEAR_2025", sport: CAREER_SPORT_YEAR_2025 },
  { scope: "YEAR_2024", sport: CAREER_SPORT_YEAR_2024 },
];

const SPORT_TABLE_SCOPE_SET = new Set<LegacyRecordScope>(
  SPORT_TABLE_LEGACY_SCOPES,
);

export type LegacySportTableRow = {
  scope: LegacyRecordScope;
  sport: string;
  wins: number;
  losses: number;
  pushes: number;
  unitsRisked: unknown;
  unitsNet: unknown;
  capturedAt?: Date | null;
};

/**
 * Per-sport carried-over aggregate from the previous SCL platform.
 * Totals only — no per-pick evidence behind these rows.
 */
export type LegacySportRecordView = {
  sport: string;
  label: string;
  wins: number;
  losses: number;
  pushes: number;
  settled: number;
  unitsRisked: number;
  units: number;
  winPct: number | null;
  roi: number | null;
};

export type LegacySportRecordRow = {
  sport: string;
  wins: number;
  losses: number;
  pushes: number;
  unitsRisked: number;
  unitsNet: number;
};

const SPORT_LABEL = new Map<string, string>([
  ...SPORTS.map((s): [string, string] => [s.key, s.label]),
  [CAREER_SPORT_OTHER, "Other"],
  [CAREER_SPORT_YEAR_2025, "2025"],
  [CAREER_SPORT_YEAR_2024, "2024"],
  [CAREER_SPORT_MULTI, "Multi-sport"],
]);

export function sportLabel(sport: string): string {
  return SPORT_LABEL.get(sport as SportKey) ?? SPORT_LABEL.get(sport) ?? sport;
}

/** Derive public view metrics from a stored LegacyRecord row. */
export function toLegacySportRecordView(
  row: LegacySportRecordRow,
): LegacySportRecordView {
  const settled = row.wins + row.losses + row.pushes;
  const decided = row.wins + row.losses;
  const unitsRisked = row.unitsRisked;
  // A push returns the stake and cannot create profit or loss. Historical
  // residual imports can contain push-only rows whose unit totals were
  // subtracted from a different source window; never publish that impossible
  // remainder even if an old row predates the database constraint.
  const units = decided > 0 ? row.unitsNet : 0;
  return {
    sport: row.sport,
    label: sportLabel(row.sport),
    wins: row.wins,
    losses: row.losses,
    pushes: row.pushes,
    settled,
    unitsRisked,
    units,
    winPct: decided > 0 ? (row.wins / decided) * 100 : null,
    roi: unitsRisked > 0 ? (units / unitsRisked) * 100 : null,
  };
}

/**
 * Sort individual-sport legacy rows for profile display:
 * units high→low, then ROI, then settled sample, then sport label.
 * The ALL sentinel is excluded — Evidence Brief already shows the combined total.
 */
export function sortLegacySportRecords(
  rows: LegacySportRecordRow[],
): LegacySportRecordView[] {
  return rows
    .filter(
      (row) =>
        row.sport !== LEGACY_RECORD_ALL_SPORTS &&
        row.wins + row.losses + row.pushes > 0,
    )
    .map(toLegacySportRecordView)
    .sort((a, b) => {
      if (b.units !== a.units) return b.units - a.units;
      const aRoi = a.roi ?? Number.NEGATIVE_INFINITY;
      const bRoi = b.roi ?? Number.NEGATIVE_INFINITY;
      if (bRoi !== aRoi) return bRoi - aRoi;
      if (b.settled !== a.settled) return b.settled - a.settled;
      return a.label.localeCompare(b.label);
    });
}

type SportTotals = {
  wins: number;
  losses: number;
  pushes: number;
  unitsRisked: number;
  unitsNet: number;
};

function emptyTotals(): SportTotals {
  return { wins: 0, losses: 0, pushes: 0, unitsRisked: 0, unitsNet: 0 };
}

function addTotals(into: SportTotals, delta: SportTotals): void {
  into.wins += delta.wins;
  into.losses += delta.losses;
  into.pushes += delta.pushes;
  into.unitsRisked += delta.unitsRisked;
  into.unitsNet += delta.unitsNet;
}

function viewToTotals(row: LegacySportRecordView): SportTotals {
  return {
    wins: row.wins,
    losses: row.losses,
    pushes: row.pushes,
    unitsRisked: row.unitsRisked,
    unitsNet: row.units,
  };
}

function sclToTotals(row: SportStats): SportTotals {
  return {
    wins: row.wins,
    losses: row.losses,
    pushes: row.pushes,
    unitsRisked: row.stakedUnits,
    unitsNet: row.units,
  };
}

function sumViews(rows: LegacySportRecordView[]): SportTotals {
  return rows.reduce((acc, row) => {
    addTotals(acc, viewToTotals(row));
    return acc;
  }, emptyTotals());
}

/**
 * Drop imported receipts that already sit inside `CURRENT_YEAR`. Only plays
 * logged after the export snapshot belong on top of that year page.
 */
export function filterPlaysAfterLegacySnapshot<T extends { createdAt: Date }>(
  plays: T[],
  capturedAt: Date | null,
): T[] {
  if (!capturedAt) return plays;
  const cutoff = capturedAt.getTime();
  return plays.filter((play) => play.createdAt.getTime() > cutoff);
}

function toTotalsFromRow(row: LegacySportTableRow): SportTotals {
  return {
    wins: row.wins,
    losses: row.losses,
    pushes: row.pushes,
    unitsRisked: Number(row.unitsRisked),
    unitsNet: Number(row.unitsNet),
  };
}

function settledOf(totals: SportTotals): number {
  return totals.wins + totals.losses + totals.pushes;
}

function subtractTotals(left: SportTotals, right: SportTotals): SportTotals {
  return {
    wins: left.wins - right.wins,
    losses: left.losses - right.losses,
    pushes: left.pushes - right.pushes,
    unitsRisked: left.unitsRisked - right.unitsRisked,
    unitsNet: left.unitsNet - right.unitsNet,
  };
}

function sumTotals(rows: SportTotals[]): SportTotals {
  return rows.reduce((acc, row) => {
    addTotals(acc, row);
    return acc;
  }, emptyTotals());
}

/**
 * Build the career-by-sport table from the old site's own counters.
 *
 * `CURRENT_YEAR` per-sport rows are the year-to-date pages (NFL 69-43, not the
 * PRE_IMPORT leftover after imported slips). A year ALL with no per-sport
 * breakdown is labeled 2025/2024 — not Other. Other is only the leftover of
 * `CURRENT_YEAR` ALL minus that year's named sports.
 */
export function assembleLegacySportTable(rows: LegacySportTableRow[]): {
  bySport: LegacySportRecordView[];
  capturedAt: Date | null;
} {
  const tableRows = rows.filter((row) => SPORT_TABLE_SCOPE_SET.has(row.scope));
  const bySport = new Map<string, SportTotals>();

  const add = (sport: string, delta: SportTotals) => {
    if (settledOf(delta) <= 0) return;
    const current = bySport.get(sport) ?? emptyTotals();
    addTotals(current, delta);
    bySport.set(sport, current);
  };

  const currentYear = tableRows.filter((row) => row.scope === "CURRENT_YEAR");
  for (const row of currentYear) {
    if (row.sport === LEGACY_RECORD_ALL_SPORTS) continue;
    add(row.sport, toTotalsFromRow(row));
  }
  if (currentYear.length === 0) {
    for (const row of rows) {
      if (row.scope !== "PRE_IMPORT") continue;
      if (row.sport === LEGACY_RECORD_ALL_SPORTS) continue;
      add(row.sport, toTotalsFromRow(row));
    }
  }

  const currentYearAll = currentYear.find(
    (row) => row.sport === LEGACY_RECORD_ALL_SPORTS,
  );
  if (currentYearAll) {
    const residual = subtractTotals(
      toTotalsFromRow(currentYearAll),
      sumTotals([...bySport.values()]),
    );
    add(CAREER_SPORT_OTHER, residual);
  }

  for (const { scope, sport: bucket } of PRIOR_YEAR_BUCKETS) {
    const yearRows = tableRows.filter((row) => row.scope === scope);
    const yearSports: SportTotals[] = [];
    for (const row of yearRows) {
      if (row.sport === LEGACY_RECORD_ALL_SPORTS) continue;
      const totals = toTotalsFromRow(row);
      if (settledOf(totals) <= 0) continue;
      add(row.sport, totals);
      yearSports.push(totals);
    }
    const yearAll = yearRows.find(
      (row) => row.sport === LEGACY_RECORD_ALL_SPORTS,
    );
    if (yearAll) {
      add(
        bucket,
        subtractTotals(toTotalsFromRow(yearAll), sumTotals(yearSports)),
      );
    }
  }

  return {
    bySport: sortLegacySportRecords(
      [...bySport.entries()].map(([sport, totals]) => ({
        sport,
        ...totals,
      })),
    ),
    capturedAt: legacySnapshotCapturedAt(currentYear),
  };
}

/**
 * Fold SCL-logged positions onto an already-assembled sport table.
 *
 * When `allBaseline` is set, any leftover versus the per-sport legacy rows
 * lands in Other. Assembled tables already carry that residual — pass null
 * so a prior-year ALL is not dumped into Other a second time.
 */
export function mergeCareerSportRecords({
  legacyBySport,
  allBaseline,
  sclBySport,
}: {
  legacyBySport: LegacySportRecordView[];
  allBaseline: StatsBaseline | null;
  sclBySport: SportStats[];
}): LegacySportRecordView[] {
  const bySport = new Map<string, SportTotals>();

  const add = (sport: string, delta: SportTotals) => {
    const current = bySport.get(sport) ?? emptyTotals();
    addTotals(current, delta);
    bySport.set(sport, current);
  };

  for (const row of legacyBySport) add(row.sport, viewToTotals(row));
  for (const row of sclBySport) add(row.sport, sclToTotals(row));

  if (allBaseline) {
    const attributed = sumViews(legacyBySport);
    const residual: SportTotals = {
      wins: allBaseline.wins - attributed.wins,
      losses: allBaseline.losses - attributed.losses,
      pushes: allBaseline.pushes - attributed.pushes,
      unitsRisked: allBaseline.stakedUnits - attributed.unitsRisked,
      unitsNet: allBaseline.units - attributed.unitsNet,
    };
    if (residual.wins + residual.losses + residual.pushes > 0) {
      add(CAREER_SPORT_OTHER, residual);
    }
  }

  return sortLegacySportRecords(
    [...bySport.entries()].map(([sport, totals]) => ({
      sport,
      ...totals,
    })),
  );
}
