/**
 * Shared performance color scale (green → amber → red) for ROI / Units / CLV / win%.
 * Number is always rendered — color is never the only signal.
 *
 * Settlement Win/Loss/Push colors stay SEPARATE (pills, unit deltas, W/L dots) —
 * do not route those through this module.
 *
 * Early / provisional samples cap at amber — never red.
 */

import { isProvisional } from "@/lib/sample";

export type PerfMetric = "roi" | "units" | "clv" | "winPct";

/** Discrete tones for CSS / StatBlock mapping. */
export type PerfTone = "pos" | "amber" | "neg" | "muted";

export type PerfScaleResult = {
  tone: PerfTone;
  /** Human band for aria / tooltips — color is never the only signal. */
  band: "strong" | "solid" | "neutral" | "soft" | "weak" | "unavailable";
  /** Accessible label combining metric + band. */
  ariaLabel: string;
};

/**
 * Thresholds (documented for tests):
 * ROI %: strong ≥ 8, solid ≥ 3, soft ≤ −3, weak ≤ −8
 * Units: strong ≥ 5, solid ≥ 1.5, soft ≤ −1.5, weak ≤ −5
 * CLV pts: strong ≥ 0.03, solid ≥ 0.01, soft ≤ −0.01, weak ≤ −0.03
 * Win %: strong ≥ 58, solid ≥ 53, soft ≤ 47, weak ≤ 42 (vs ~52.4% breakeven −110)
 */
const BANDS: Record<
  PerfMetric,
  { strong: number; solid: number; soft: number; weak: number }
> = {
  roi: { strong: 8, solid: 3, soft: -3, weak: -8 },
  units: { strong: 5, solid: 1.5, soft: -1.5, weak: -5 },
  clv: { strong: 0.03, solid: 0.01, soft: -0.01, weak: -0.03 },
  winPct: { strong: 58, solid: 53, soft: 47, weak: 42 },
};

function bandFor(metric: PerfMetric, value: number): PerfScaleResult["band"] {
  const t = BANDS[metric];
  if (value >= t.strong) return "strong";
  if (value >= t.solid) return "solid";
  if (value <= t.weak) return "weak";
  if (value <= t.soft) return "soft";
  return "neutral";
}

function toneForBand(band: PerfScaleResult["band"]): PerfTone {
  switch (band) {
    case "strong":
    case "solid":
      return "pos";
    case "soft":
    case "weak":
      return "neg";
    case "neutral":
    case "unavailable":
    default:
      return "muted";
  }
}

/**
 * Map a performance metric to tone + band.
 * @param gradedCount — when provisional, never return red (neg); soft/weak → amber.
 */
export function perfScale(
  metric: PerfMetric,
  value: number | null | undefined,
  opts?: { gradedCount?: number | null; label?: string },
): PerfScaleResult {
  const label = opts?.label ?? metricLabel(metric);
  if (value == null || !Number.isFinite(value)) {
    return {
      tone: "muted",
      band: "unavailable",
      ariaLabel: `${label}: unavailable`,
    };
  }

  const band = bandFor(metric, value);
  let tone = toneForBand(band);

  if (isProvisional(opts?.gradedCount) && tone === "neg") {
    tone = "amber";
    // Keep soft/weak band identity for honesty; only soften color.
  }

  return {
    tone,
    band,
    ariaLabel: `${label}: ${formatPerfValue(metric, value)} (${band})`,
  };
}

export function metricLabel(metric: PerfMetric): string {
  switch (metric) {
    case "roi":
      return "ROI";
    case "units":
      return "Units";
    case "clv":
      return "CLV";
    case "winPct":
      return "Win rate";
  }
}

export function formatPerfValue(metric: PerfMetric, value: number): string {
  switch (metric) {
    case "roi":
      return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
    case "units":
      return `${value > 0 ? "+" : ""}${value.toFixed(2).replace(/\.00$/, "")}U`;
    case "clv":
      return `${value > 0 ? "+" : ""}${value.toFixed(2)} pts`;
    case "winPct":
      return `${value.toFixed(1)}%`;
  }
}

/** Map perf tone → StatBlock / CSS tone keys (amber uses muted visually with data attr). */
export function perfToneToStatTone(
  tone: PerfTone,
): "pos" | "neg" | "muted" | "default" {
  if (tone === "pos") return "pos";
  if (tone === "neg") return "neg";
  return "muted";
}

/** Tailwind-friendly class for amber provisional soft/weak. */
export function perfToneClass(tone: PerfTone): string {
  switch (tone) {
    case "pos":
      return "text-pos";
    case "neg":
      return "text-neg";
    case "amber":
      return "text-amber-600 dark:text-amber-400";
    case "muted":
    default:
      return "text-muted-foreground";
  }
}
