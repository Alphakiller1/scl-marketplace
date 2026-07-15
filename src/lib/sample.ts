/**
 * Sample-size gates for public performance signals.
 * Below the threshold we show honest empties — never a fabricated trend/streak.
 */

/** Minimum graded picks before trend / streak / non-provisional ROI read as signal. */
export const MIN_GRADED_FOR_SIGNAL = 10;

/** True when graded count is large enough to support a performance signal. */
export function hasSignal(gradedCount: number): boolean {
  return Number.isFinite(gradedCount) && gradedCount >= MIN_GRADED_FOR_SIGNAL;
}
