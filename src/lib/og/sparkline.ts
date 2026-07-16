/**
 * Build an SVG path `d` for a cumulative-unit sparkline (same sampling semantics
 * as PerformanceSparkline — points are already cumulative units).
 */
export function buildSparklinePath(
  points: number[],
  width: number,
  height: number,
  padding = 12,
): {
  d: string;
  strokeTone: "win" | "loss" | "flat";
  lastX: number;
  lastY: number;
} {
  const values = points.length ? points : [0, 0];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;

  const coords = values.map((value, index) => {
    const x =
      values.length === 1
        ? width / 2
        : padding + (index / (values.length - 1)) * plotWidth;
    const y = padding + ((max - value) / range) * plotHeight;
    return { x, y };
  });

  const d = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");

  const delta = values.at(-1)! - values[0];
  const strokeTone = delta > 0 ? "win" : delta < 0 ? "loss" : "flat";
  const last = coords.at(-1)!;

  return { d, strokeTone, lastX: last.x, lastY: last.y };
}
