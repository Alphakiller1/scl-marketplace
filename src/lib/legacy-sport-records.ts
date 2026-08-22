import { SPORTS, type SportKey } from "@/lib/constants";
import { LEGACY_RECORD_ALL_SPORTS } from "@/lib/schemas/legacy-records.schema";
import type { SportStats, StatsBaseline } from "@/lib/stats";

/** Unattributed all-time remainder when ALL ≠ sum of per-sport rows. */
export const CAREER_SPORT_OTHER = "OTHER";

/** Parlay with no first-leg sport. */
export const CAREER_SPORT_MULTI = "MULTI";

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
 * One career-by-sport table: all-time legacy per sport + SCL-logged positions
 * (imported 90-day receipts and anything logged on this site).
 *
 * Evidence Brief uses the ALL all-time baseline plus those same positions.
 * Customers do not care which era a pick came from, so this table is built to
 * sum to that headline sample. When ALL is larger than the per-sport legacy
 * rows, the unattributed remainder lands in Other — it is not "new-site" volume.
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
