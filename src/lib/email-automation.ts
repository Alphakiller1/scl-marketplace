export const EMAIL_AUTOMATION_CONFIG_ID = "primary";
export const EMAIL_AUTOMATION_LOCK_KEY = "capper-lifecycle-email";
export const EMAIL_AUTOMATION_KEYS = [
  "VERIFY_EMAIL_REMINDER",
  "NO_PLAYS_NUDGE",
] as const;

export type EmailAutomationKey = (typeof EMAIL_AUTOMATION_KEYS)[number];

export const EMAIL_AUTOMATION_DEFAULTS = {
  verificationReminderEnabled: false,
  verificationReminderDelayHours: 24,
  verificationReminderActivatedAt: null as Date | null,
  noPlaysNudgeEnabled: false,
  noPlaysNudgeDelayHours: 72,
  noPlaysNudgeActivatedAt: null as Date | null,
  dailyLimit: 25,
} as const;

export const EMAIL_AUTOMATION_LIMITS = {
  minimumVerificationDelayHours: 24,
  minimumNoPlaysDelayHours: 24,
  maximumDelayHours: 24 * 30,
  minimumDailyLimit: 1,
  // Preserve at least half of the known 100/day allowance for verification,
  // password resets, previews, and owner messages.
  maximumDailyLimit: 50,
  maximumAttempts: 3,
  retryDelayMs: 15 * 60 * 1_000,
  staleClaimMs: 10 * 60 * 1_000,
  lockMs: 10 * 60 * 1_000,
} as const;

export function eligibilityCutoff(now: Date, delayHours: number): Date {
  return new Date(now.getTime() - delayHours * 60 * 60 * 1_000);
}

export function rollingDayStart(now: Date): Date {
  return new Date(now.getTime() - 24 * 60 * 60 * 1_000);
}

export function remainingAutomationCapacity(
  dailyLimit: number,
  sentInRollingDay: number,
): number {
  return Math.max(0, dailyLimit - sentInRollingDay);
}

export function retryAt(now: Date): Date {
  return new Date(now.getTime() + EMAIL_AUTOMATION_LIMITS.retryDelayMs);
}

/** Start a fresh cohort on every off → on transition and self-heal an enabled
 * row whose activation timestamp was removed by a manual database edit. */
export function nextAutomationActivationAt(input: {
  wasEnabled: boolean;
  enabled: boolean;
  current: Date | null;
  now: Date;
}): Date | null {
  if (input.enabled && (!input.wasEnabled || !input.current)) return input.now;
  return input.current;
}
