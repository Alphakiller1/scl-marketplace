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

export function warnThresholdUsed(): number {
  return MONTHLY_CAP * 0.7;
}

export function alertThresholdUsed(): number {
  return MONTHLY_CAP * 0.9;
}

/** When remaining credits drop below 1,000 (5%), stop uncached board fetches. */
export function shouldCircuitBreak(remaining: number | null): boolean {
  return remaining != null && remaining < REMAINING_CIRCUIT_BREAK;
}

export function isWarnLevel(remaining: number | null): boolean {
  return remaining != null && remaining <= REMAINING_WARN;
}

export function isAlertLevel(remaining: number | null): boolean {
  return remaining != null && remaining <= REMAINING_ALERT;
}
