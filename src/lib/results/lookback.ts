/**
 * The Odds API scores endpoint max `daysFrom` window.
 * Plays whose eventStartsAt is older than this cannot be settled via the
 * live scores feed and must be classified as `aged_out`, not retried silently.
 */
export const RESULTS_LOOKBACK_DAYS = 3;

/** Alert when a pending play is within 1 day of falling off the lookback cliff. */
export const RESULTS_CLIFF_WARNING_DAYS = RESULTS_LOOKBACK_DAYS - 1;
