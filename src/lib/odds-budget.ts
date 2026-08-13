/**
 * Odds API monthly credit budget (see docs/qa/SCL_GPT_CLAUDE_DELIVERABLES.md Step 5).
 * Cap: 20,000 credits · soft warn 70% · hard alert 90% · circuit-break 95%.
 */

export const MONTHLY_CAP = 20_000;

/** Credits remaining when 70% of the monthly cap is consumed. */
export const REMAINING_WARN = MONTHLY_CAP * 0.3;

/** Credits remaining when 90% of the monthly cap is consumed. */
export const REMAINING_ALERT = MONTHLY_CAP * 0.1;

/** Credits remaining when the circuit-breaker engages (5% left). */
export const REMAINING_CIRCUIT_BREAK = 1_000;

/**
 * Smallest reserve the breaker will ever hold back, whatever the plan.
 *
 * A percentage of a tiny plan rounds to nothing, which would spend the last few
 * credits on a board refresh instead of the pick a capper is submitting.
 */
export const MIN_CIRCUIT_BREAK_RESERVE = 25;

export function warnThresholdUsed(): number {
  return MONTHLY_CAP * 0.7;
}

export function alertThresholdUsed(): number {
  return MONTHLY_CAP * 0.9;
}

/**
 * The reserve to hold back for a key on a plan of `capacity` credits.
 *
 * The flat 1,000 floor was written for the 20,000-credit plan, where it is
 * exactly the 5% reserve it claims to be. On a smaller plan it stops being a
 * reserve and becomes a total ban: a 500-credit key starts *below* the
 * threshold, so the breaker trips on the very first response and every board
 * serves `circuit_break_empty` for the life of the key — which is never spent,
 * only refused. That is a silent, permanent outage produced by a constant, so
 * the reserve now scales with the plan the key is actually on.
 *
 * Capacity is observed, not configured: The Odds API returns both
 * `x-requests-remaining` and `x-requests-used` on every response and their sum
 * is the plan cap. Unknown capacity keeps the historical 1,000, so behaviour on
 * the big plan is unchanged.
 */
export function circuitBreakThreshold(capacity: number | null): number {
  if (capacity == null || capacity <= 0) return REMAINING_CIRCUIT_BREAK;
  return Math.max(
    MIN_CIRCUIT_BREAK_RESERVE,
    Math.min(REMAINING_CIRCUIT_BREAK, Math.floor(capacity * 0.05)),
  );
}

/**
 * When remaining credits drop into the reserve, stop uncached board fetches.
 *
 * `capacity` is the observed plan size; omit it and the 20,000-plan reserve of
 * 1,000 applies, which is the historical behaviour.
 */
export function shouldCircuitBreak(
  remaining: number | null,
  capacity: number | null = null,
): boolean {
  return remaining != null && remaining < circuitBreakThreshold(capacity);
}

export function isWarnLevel(remaining: number | null): boolean {
  return remaining != null && remaining <= REMAINING_WARN;
}

export function isAlertLevel(remaining: number | null): boolean {
  return remaining != null && remaining <= REMAINING_ALERT;
}
