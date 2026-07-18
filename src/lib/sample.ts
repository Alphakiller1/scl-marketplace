/**
 * Sample-size gates for public performance signals.
 * Below the threshold we show honest empties — never a fabricated trend/streak.
 */

/** Minimum graded picks before trend / streak / podium crown / non-provisional ROI. */
export const MIN_GRADED_FOR_SIGNAL = 10;

/**
 * Sample maturity buckets (one source of truth).
 * Established ≥50 · Developing 10–49 · Early 0–9 (Early = the &lt;10 rank gate).
 */
export const MATURITY = {
  ESTABLISHED: 50,
  DEVELOPING: MIN_GRADED_FOR_SIGNAL,
} as const;

export type MaturityBucket = "established" | "developing" | "early";

/** Exact public labels for the three maturity buckets. */
export const MATURITY_LABELS = {
  established: "Established 50+",
  developing: "Developing 10–49",
  early: "Early 0–9",
} as const;

/** Legend line listing all buckets (exact copy). */
export const MATURITY_LEGEND = "Established 50+ · Developing 10–49 · Early 0–9";

export function maturityBucket(gradedCount: number): MaturityBucket {
  const n = Number.isFinite(gradedCount) ? gradedCount : 0;
  if (n >= MATURITY.ESTABLISHED) return "established";
  if (n >= MATURITY.DEVELOPING) return "developing";
  return "early";
}

export function maturityLabel(gradedCount: number): string {
  return MATURITY_LABELS[maturityBucket(gradedCount)];
}

/** True when graded count is large enough to support a performance signal. */
export function hasSignal(gradedCount: number): boolean {
  return Number.isFinite(gradedCount) && gradedCount >= MIN_GRADED_FOR_SIGNAL;
}

/** Inverse of {@link hasSignal} — small-sample / provisional record. */
export function isProvisional(
  settledPicks: number | null | undefined,
): boolean {
  return !hasSignal(settledPicks ?? 0);
}
