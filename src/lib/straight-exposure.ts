export type StraightExposure = {
  eventId: string | null;
  market: string;
  selection: string;
  side: string | null;
  line: unknown;
  units: number;
  isSupermax: boolean;
};

export function straightExposureKey(
  play: Omit<StraightExposure, "units" | "isSupermax">,
) {
  return [
    play.eventId ?? "",
    play.market.trim().toLowerCase(),
    play.selection.trim().toLowerCase(),
    play.side?.trim().toLowerCase() ?? "",
    play.line == null ? "" : Number(play.line).toFixed(2),
  ].join("|");
}

/** Event IDs whose earlier straight positions can contribute to a duplicate cap. */
export function straightExposureEventIds(
  plays: readonly Pick<StraightExposure, "eventId">[],
): string[] {
  return [
    ...new Set(plays.flatMap((play) => (play.eventId ? [play.eventId] : []))),
  ];
}

/** Pure policy check shared by single and bulk straight-pick writes. */
export function straightExposureError(
  existing: readonly StraightExposure[],
  incoming: readonly StraightExposure[],
): string | null {
  if (
    incoming.filter((play) => play.isSupermax).length > 1 ||
    (incoming.some((play) => play.isSupermax) &&
      existing.some((play) => play.isSupermax))
  ) {
    return "Only one 20u Supermax straight bet is allowed per day.";
  }

  const totals = new Map<string, number>();
  for (const play of existing) {
    if (play.isSupermax) continue;
    const key = straightExposureKey(play);
    totals.set(key, (totals.get(key) ?? 0) + play.units);
  }
  for (const play of incoming) {
    if (play.isSupermax) continue;
    const key = straightExposureKey(play);
    const total = (totals.get(key) ?? 0) + play.units;
    if (total > 10) {
      return "Duplicate straight bets cannot exceed 10u combined. Parlays remain unaffected.";
    }
    totals.set(key, total);
  }
  return null;
}
