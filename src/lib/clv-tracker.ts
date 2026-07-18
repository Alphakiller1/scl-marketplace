/**
 * CLV tracker summaries — READ stored Play.clvPts only.
 * Never recompute from odds here (grade-time pipeline owns compute).
 */

import { hasSignal, MIN_GRADED_FOR_SIGNAL } from "@/lib/sample";

export type ClvTrackerSummary = {
  /** Picks with a stored closing snapshot (clvPts not null). */
  snapshotCount: number;
  /** Signal-sized snapshot sample? */
  hasSignal: boolean;
  /**
   * Mean of stored clvPts. Null when snapshotCount &lt; MIN_GRADED_FOR_SIGNAL
   * (honest empty — never fabricate 0.0).
   */
  avgClv: number | null;
  /**
   * Share of snapshots with clvPts &gt; 0 (0–100). Null when under signal.
   */
  beatClosePct: number | null;
  /** Count of snapshots that beat the close (clvPts &gt; 0). */
  beatCloseCount: number;
  /** Histogram bins (always present; may be all zeros). */
  bins: ClvHistogramBin[];
  /** Accessible text summary of the distribution. */
  distributionSummary: string;
};

export type ClvHistogramBin = {
  /** Midpoint label for the axis, e.g. "-0.04". */
  label: string;
  /** Inclusive lower bound (last bin is open-ended on the right in labeling only). */
  from: number;
  /** Exclusive upper bound. */
  to: number;
  count: number;
};

/**
 * Fixed, zero-centered bins for a stable Recharts domain.
 * Edges: −∞…−0.06 · −0.06…−0.03 · −0.03…−0.01 · −0.01…0.01 ·
 * 0.01…0.03 · 0.03…0.06 · 0.06…+∞
 */
export const CLV_HISTOGRAM_EDGES = [
  -Infinity,
  -0.06,
  -0.03,
  -0.01,
  0.01,
  0.03,
  0.06,
  Infinity,
] as const;

function binLabel(from: number, to: number): string {
  if (!Number.isFinite(from)) return `≤${to.toFixed(2)}`;
  if (!Number.isFinite(to)) return `≥${from.toFixed(2)}`;
  const mid = (from + to) / 2;
  return `${mid >= 0 ? "+" : ""}${mid.toFixed(2)}`;
}

function emptyBins(): ClvHistogramBin[] {
  const bins: ClvHistogramBin[] = [];
  for (let i = 0; i < CLV_HISTOGRAM_EDGES.length - 1; i++) {
    const from = CLV_HISTOGRAM_EDGES[i]!;
    const to = CLV_HISTOGRAM_EDGES[i + 1]!;
    bins.push({ label: binLabel(from, to), from, to, count: 0 });
  }
  return bins;
}

function roundAvg(n: number): number {
  return Math.round((n + Number.EPSILON) * 10_000) / 10_000;
}

/**
 * Summarize stored CLV points. Pass only non-null finite clvPts values —
 * do not invent zeros for missing snapshots.
 */
export function summarizeClvTracker(
  clvPtsList: readonly number[],
): ClvTrackerSummary {
  const pts = clvPtsList.filter((v) => Number.isFinite(v));
  const snapshotCount = pts.length;
  const bins = emptyBins();

  let beatCloseCount = 0;
  let sum = 0;
  for (const v of pts) {
    sum += v;
    if (v > 0) beatCloseCount += 1;
    const idx = bins.findIndex((b) => v >= b.from && v < b.to);
    // Last bin includes +Infinity upper — also catch exact upper edge of penultimate.
    if (idx >= 0) bins[idx]!.count += 1;
    else bins[bins.length - 1]!.count += 1;
  }

  const signal = hasSignal(snapshotCount);
  const avgClv =
    signal && snapshotCount > 0 ? roundAvg(sum / snapshotCount) : null;
  const beatClosePct =
    signal && snapshotCount > 0
      ? Math.round((beatCloseCount / snapshotCount) * 1000) / 10
      : null;

  const distributionSummary =
    snapshotCount === 0
      ? "No closing snapshots recorded yet. CLV distribution is empty."
      : signal
        ? `CLV distribution across ${snapshotCount} closing snapshots. ${beatCloseCount} beat the close${
            avgClv != null
              ? `; average ${avgClv >= 0 ? "+" : ""}${avgClv.toFixed(2)} pts`
              : ""
          }.`
        : `CLV distribution provisional — ${snapshotCount} snapshot${
            snapshotCount === 1 ? "" : "s"
          } (needs ${MIN_GRADED_FOR_SIGNAL}+ for a signal).`;

  return {
    snapshotCount,
    hasSignal: signal,
    avgClv,
    beatClosePct,
    beatCloseCount,
    bins,
    distributionSummary,
  };
}

/** Honest empty copy when no snapshots (or under signal for metric faces). */
export const CLV_TRACKER_EMPTY_TITLE = "CLV not available yet";

export const CLV_TRACKER_EMPTY_BODY =
  "No closing snapshots are stored for this sample. CLV appears after board-verified picks capture a closing line — historical plays without a close stay as em dashes.";

export const CLV_TRACKER_PROVISIONAL_BODY = `CLV unlocks after ${MIN_GRADED_FOR_SIGNAL} closing snapshots. Showing an honest empty, not a fabricated 0.0.`;

export const PLATFORM_CLV_EMPTY_BODY =
  "No board-verified closing snapshots across public listed cappers yet. Platform CLV will populate as forward picks capture closes.";
