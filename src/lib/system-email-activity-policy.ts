export const SYSTEM_EMAIL_ACTIVITY_RETENTION_DAYS = 14;
const RETENTION_MS = SYSTEM_EMAIL_ACTIVITY_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export function systemEmailActivityCutoff(now = new Date()): Date {
  return new Date(now.getTime() - RETENTION_MS);
}
