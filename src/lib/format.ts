/** Display formatters for SCL stats. Numbers are the product — keep them crisp. */

export function formatOdds(american: number): string {
  return american > 0 ? `+${american}` : `${american}`;
}

export function formatUnits(
  units: number,
  withSuffix = true,
  signed = true,
): string {
  const sign = signed && units > 0 ? "+" : "";
  const val = `${sign}${units.toFixed(2).replace(/\.00$/, "")}`;
  return withSuffix ? `${val}U` : val;
}

export function formatRoi(roiPct: number): string {
  const sign = roiPct > 0 ? "+" : "";
  return `${sign}${roiPct.toFixed(1)}%`;
}

export function formatPct(pct: number): string {
  return `${pct.toFixed(1)}%`;
}

export function formatRecord(w: number, l: number, p = 0): string {
  return p > 0 ? `${w}-${l}-${p}` : `${w}-${l}`;
}

/** Semantic tone for a signed number: positive=pos, negative=neg, else muted. */
export function signTone(n: number): "pos" | "neg" | "muted" {
  if (n > 0) return "pos";
  if (n < 0) return "neg";
  return "muted";
}

export function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
