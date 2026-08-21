/** Conservative maximum time from scheduled start until a final should exist. */
const EXPECTED_FINAL_HOURS: Record<string, number> = {
  MLB: 6,
  NBA: 5,
  WNBA: 5,
  NCAAB: 5,
  NFL: 6,
  NCAAF: 6,
  CFL: 6,
  NHL: 5,
  SOCCER: 4,
  TENNIS: 7,
  MMA: 8,
};

export function expectedFinalHours(sport: string): number {
  return EXPECTED_FINAL_HOURS[sport.toUpperCase()] ?? 8;
}

export function expectedFinalAt(sport: string, startsAt: Date): Date {
  return new Date(
    startsAt.getTime() + expectedFinalHours(sport) * 60 * 60 * 1_000,
  );
}

/** Missing final before this boundary means the event may simply still be live. */
export function isAwaitingExpectedFinal(
  sport: string,
  startsAt: Date | null | undefined,
  now: Date,
): boolean {
  return startsAt != null && expectedFinalAt(sport, startsAt) > now;
}
