export const SYSTEM_EMAIL_ACTIVITY_RETENTION_DAYS = 14;
const RETENTION_MS = SYSTEM_EMAIL_ACTIVITY_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/**
 * The admin ledger is intentionally a lifecycle-automation monitor, not a
 * general outbound-mail archive. Owner broadcasts, password/security mail and
 * storefront notifications stay out.
 *
 * The account lifecycle is now covered end to end: VERIFICATION, its reminder,
 * and the welcome that follows it. Logging the reminder but not the mail it
 * reminds you about was not a boundary, it was a hole — a capper reported never
 * receiving his verification link and there was no row for it, for him or for
 * anyone, so nobody could tell a provider failure from a spam folder from a
 * send that never happened. The owners spent the morning guessing at a sending
 * quota that was at two percent of its limit.
 *
 * NEW_SIGNUP_NOTIFICATION is the one admin-facing entry, and it earns its place
 * for the same reason: it is how the owners learn a capper joined at all, so
 * "did that fire?" has to be answerable.
 */
export const SYSTEM_EMAIL_ACTIVITY_TYPES = [
  "WELCOME",
  "VERIFICATION",
  "VERIFY_EMAIL_REMINDER",
  "NO_PLAYS_NUDGE",
  "NEW_SIGNUP_NOTIFICATION",
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
