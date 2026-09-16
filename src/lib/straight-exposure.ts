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

export const SUPERMAX_STACK_ERROR =
  "A Supermax play cannot be combined with another straight bet on the same selection.";

/** Same event, market, and side, whatever the line — alt lines still stack. */
function selectionKey(play: StraightExposure): string | null {
  return play.eventId ? straightExposureKey({ ...play, line: null }) : null;
}

/**
 * A Supermax is the whole position on its selection: no straight may be added
 * beside it, and it may not be placed on a selection already bet. Otherwise
 * 10u + 20u reaches 30u on one play.
 */
function supermaxStacks(
  existing: readonly StraightExposure[],
  incoming: readonly StraightExposure[],
): boolean {
  const seen = new Map<string, { supermax: boolean; plain: boolean }>();
  const all = [...existing, ...incoming];
  for (const play of all) {
    const key = selectionKey(play);
    if (!key) continue;
    const entry = seen.get(key) ?? { supermax: false, plain: false };
    if (play.isSupermax) entry.supermax = true;
    else entry.plain = true;
    seen.set(key, entry);
  }
  return incoming.some((play) => {
    const key = selectionKey(play);
    const entry = key ? seen.get(key) : undefined;
    return Boolean(entry?.supermax && entry.plain);
  });
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
    return "Only one 20u Supermax bet is allowed per day.";
  }

  if (supermaxStacks(existing, incoming)) return SUPERMAX_STACK_ERROR;

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
