export const CROSS_SPORTS = "CROSS_SPORTS";
export const CROSS_SPORTS_LABEL = "Cross-Sports";

/** One reporting bucket per parlay, preventing multi-sport tickets from inflating leagues. */
export function parlayReportingSport(
  legs: readonly { sport: string }[],
): string {
  const sports = new Set(legs.map((leg) => leg.sport).filter(Boolean));
  if (sports.size > 1) return CROSS_SPORTS;
  return sports.values().next().value ?? CROSS_SPORTS;
}
