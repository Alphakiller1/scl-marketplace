import type { CapperSummary } from "@/lib/mock";
import type { ProfileChartSeries } from "@/lib/profile-chart-window";
import { isProvisional } from "@/lib/sample";

export type PackageEvidence = {
  settledPicks: number;
  record: { w: number; l: number; p: number } | null;
  roi: number | null;
  units: number | null;
  verifiedShare: number | null;
  provisional: boolean;
};

export type ProfilePackageInsight = {
  id: string;
  title: string;
  evidence: PackageEvidence | null;
  chartSeries: ProfileChartSeries;
  chartSeriesBySport: Record<string, ProfileChartSeries>;
  sports: string[];
};

/**
 * Translate an all-time public capper summary into marketplace evidence.
 * A zero-grade account intentionally receives honest nulls, never synthetic zero performance.
 */
export function packageEvidenceFromCapper(
  capper: CapperSummary | null | undefined,
): PackageEvidence | null {
  if (!capper) return null;

  const settledPicks = capper.settledPicks ?? 0;
  if (settledPicks === 0) {
    return {
      settledPicks,
      record: null,
      roi: null,
      units: null,
      verifiedShare: null,
      provisional: true,
    };
  }

  return {
    settledPicks,
    record: capper.record,
    roi: capper.roi,
    units: capper.units,
    verifiedShare: capper.verifiedShare ?? null,
    provisional: isProvisional(settledPicks),
  };
}

export function indexPackageEvidence(
  cappers: CapperSummary[],
): Map<string, PackageEvidence> {
  const evidence = new Map<string, PackageEvidence>();
  for (const capper of cappers) {
    const row = packageEvidenceFromCapper(capper);
    if (row) evidence.set(capper.id, row);
  }
  return evidence;
}
