export const SYSTEM_EMAIL_ACTIVITY_RETENTION_DAYS = 14;
const RETENTION_MS = SYSTEM_EMAIL_ACTIVITY_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/**
 * The admin ledger is intentionally a lifecycle-automation monitor, not a
 * general outbound-mail archive. Welcome is included because SCL sends it
 * automatically after verification; security mail, owner broadcasts, and
 * storefront notifications are deliberately excluded.
 */
export const SYSTEM_EMAIL_ACTIVITY_TYPES = [
  "WELCOME",
  "VERIFY_EMAIL_REMINDER",
  "NO_PLAYS_NUDGE",
] as const;

export type SystemEmailActivityType =
  (typeof SYSTEM_EMAIL_ACTIVITY_TYPES)[number];

export function isSystemEmailActivityType(
  value: string,
): value is SystemEmailActivityType {
  return (SYSTEM_EMAIL_ACTIVITY_TYPES as readonly string[]).includes(value);
}

export function systemEmailActivityCutoff(now = new Date()): Date {
  return new Date(now.getTime() - RETENTION_MS);
}
