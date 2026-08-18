import { SPORTS, type SportKey } from "@/lib/constants";
import { LEGACY_RECORD_ALL_SPORTS } from "@/lib/schemas/legacy-records.schema";

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

const SPORT_LABEL = new Map<string, string>(
  SPORTS.map((s) => [s.key, s.label]),
);

function sportLabel(sport: string): string {
  return SPORT_LABEL.get(sport as SportKey) ?? sport;
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
