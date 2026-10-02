/**
 * Pure rules for the Brevo campaign queue: how a refused provider call is
 * handled, and how webhook events map onto the recipient ledger. No network, no
 * DB, so each rule is unit-tested in `brevo-send.test.ts`.
 */

/**
 * - `retryable`: Brevo answered and did not accept the message (rate limit or
 *   a server error). Re-queue it; the next run tries again.
 * - `fatal`: the account itself is refused (bad key, plan limit). Re-queue and
 *   stop the whole run — every further call would fail the same way and burn
 *   through the campaign.
 * - `permanent`: this one message cannot be sent, or the outcome is unknown.
 */
export type BrevoFailureKind = "retryable" | "fatal" | "permanent";

export const BREVO_MAX_ATTEMPTS = 5;

export function classifyBrevoFailure(status: number): BrevoFailureKind {
  if (status === 401 || status === 402 || status === 403) return "fatal";
  if (status === 429) return "fatal";
  if (status >= 500) return "retryable";
  return "permanent";
}

/** Brevo's own event names, with older aliases accepted. */
export type LedgerEvent =
  | "delivered"
  | "opened"
  | "proxy_open"
  | "hard_bounce"
  | "soft_bounce"
  | "blocked"
  | "invalid"
  | "unsubscribed"
  | "spam"
  | "error";

export function normalizeBrevoEvent(raw: string): LedgerEvent | null {
  switch (raw.trim().toLowerCase()) {
    case "delivered":
      return "delivered";
    case "opened":
    case "unique_opened":
      return "opened";
    // Apple Mail Privacy Protection pre-fetches every message, so a proxy open
    // proves delivery but says nothing about a person reading it.
    case "proxy_open":
    case "unique_proxy_open":
      return "proxy_open";
    case "hard_bounce":
    case "hardbounce":
      return "hard_bounce";
    case "soft_bounce":
    case "softbounce":
      return "soft_bounce";
    case "blocked":
      return "blocked";
    case "invalid":
    case "invalid_email":
      return "invalid";
    case "unsubscribed":
    case "unsubscribe":
      return "unsubscribed";
    case "spam":
    case "complaint":
      return "spam";
    case "error":
      return "error";
    default:
      return null;
  }
}

/** Errors that permanently suppress an address from future campaigns. */
export const SUPPRESSING_BOUNCE_ERRORS = [
  "hard_bounce",
  "blocked",
  "invalid",
] as const;

/** Event time from Brevo's payload (`ts_event` seconds, or `date`), else now. */
export function brevoEventTime(
  event: Record<string, unknown>,
  now: Date = new Date(),
): Date {
  const ts = event.ts_event ?? event.ts_epoch ?? event.ts;
  if (typeof ts === "number" && Number.isFinite(ts) && ts > 0) {
    // ts_epoch is milliseconds; ts_event / ts are seconds.
    const date = new Date(ts > 1e12 ? ts : ts * 1000);
    if (!Number.isNaN(date.getTime()) && date <= now) return date;
  }
  if (typeof event.date === "string") {
    const date = new Date(event.date);
    if (!Number.isNaN(date.getTime()) && date <= now) return date;
  }
  return now;
}
