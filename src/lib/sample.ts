/**
 * Sample-size gates for public performance signals.
 * Below the threshold we show honest empties — never a fabricated trend/streak.
 */

/** Minimum graded picks before trend / streak / podium crown / non-provisional ROI. */
export const MIN_GRADED_FOR_SIGNAL = 10;

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
