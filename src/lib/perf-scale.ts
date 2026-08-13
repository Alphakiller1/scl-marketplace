/**
 * Shared performance color scale (green → amber → red) for ROI / Units / CLV / win%.
 * Number is always rendered — color is never the only signal.
 *
 * Settlement Win/Loss/Push colors stay SEPARATE (pills, unit deltas, W/L dots) —
 * do not route those through this module.
 *
 * Early / provisional samples cap at amber — never red and never green.
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

  // Early samples cap at amber — never red (failure) and never green (elite).
  // Band identity stays honest for aria; only the color is softened.
  if (isProvisional(opts?.gradedCount) && (tone === "neg" || tone === "pos")) {
    tone = "amber";
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
    case "clv": {
      // A CLV that rounds to zero keeps the number and loses the sign. This
      // string is mostly an aria-label, and "-0.00 pts" told a screen-reader
      // user the capper came out behind the close while the sighted user saw
      // an em-dash. Zero is the honest reading; the minus was an artifact of
      // rounding a tiny negative.
      //
      // Round through Number first: toFixed carries the sign itself, so
      // (-0.0001).toFixed(2) is "-0.00" no matter what prefix we choose. The
      // round-trip lands on -0, which formats as "0.00".
      const rounded = Number(value.toFixed(2));
      return `${rounded > 0 ? "+" : ""}${rounded.toFixed(2)} pts`;
    }
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

/** Tailwind-friendly class for perf spectrum text (AA-safe *text* tokens). */
export function perfToneClass(tone: PerfTone): string {
  switch (tone) {
    case "pos":
      return "text-[color:var(--scl-perf-strong-text)]";
    case "neg":
      return "text-[color:var(--scl-perf-weak-text)]";
    case "amber":
      return "text-[color:var(--scl-perf-mid-text)]";
    case "muted":
    default:
      return "text-muted-foreground";
  }
}
