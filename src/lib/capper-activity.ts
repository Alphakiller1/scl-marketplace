/**
 * Compact activity windows for the public capper profile.
 * Counts positions of record (straight plays + parlays), not parlay legs.
 */

export type CapperActivitySummary = {
  last3Days: number;
  last14Days: number;
  month: number;
};

const DAY_MS = 86_400_000;
export const PUBLIC_CAPPER_INACTIVITY_DAYS = 30;

/** A public capper returns to the leaderboard immediately after a new position. */
export function publicCapperActivityCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - PUBLIC_CAPPER_INACTIVITY_DAYS * DAY_MS);
}

export function hasRecentPublicCapperActivity(
  createdAts: readonly Date[],
  now: Date = new Date(),
): boolean {
  const cutoff = publicCapperActivityCutoff(now).getTime();
  return createdAts.some((createdAt) => createdAt.getTime() >= cutoff);
}

export function computeCapperActivity(
  createdAts: readonly Date[],
  now: Date = new Date(),
): CapperActivitySummary {
  const t3 = now.getTime() - 3 * DAY_MS;
  const t14 = now.getTime() - 14 * DAY_MS;
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).getTime();

  let last3Days = 0;
  let last14Days = 0;
  let month = 0;
  for (const createdAt of createdAts) {
    const t = createdAt.getTime();
    if (t >= t3) last3Days += 1;
    if (t >= t14) last14Days += 1;
    if (t >= monthStart) month += 1;
  }
  return { last3Days, last14Days, month };
}

/** Short “Last pick” label, e.g. "Jul 13" / "Jul 13, 2025". */
export function formatLastPickDate(
  lastPlayAt: Date | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!lastPlayAt) return null;
  const sameYear = lastPlayAt.getFullYear() === now.getFullYear();
  return lastPlayAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "America/New_York",
  });
}
