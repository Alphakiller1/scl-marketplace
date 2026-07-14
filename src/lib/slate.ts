/** Local calendar-day helpers for the Today/Tomorrow slate (shared by SportPills / OddsAssist / GamePicker). */

export type SlateDay = "today" | "tomorrow";

/** Local calendar-day key (matches the date the board displays), no time component. */
export function localDateKey(d: Date): string {
  return d.toDateString();
}

export function slateDayKeys(now = new Date()): Record<SlateDay, string> {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { today: localDateKey(now), tomorrow: localDateKey(tomorrow) };
}

/** Events whose commence time falls on today or tomorrow (local). */
export function nearTermEvents<T extends { commenceTime: string }>(
  events: readonly T[],
  now = new Date(),
): T[] {
  const keys = slateDayKeys(now);
  return events.filter((e) => {
    const k = localDateKey(new Date(e.commenceTime));
    return k === keys.today || k === keys.tomorrow;
  });
}

export function filterBySlateDay<T extends { commenceTime: string }>(
  events: readonly T[],
  day: SlateDay,
  now = new Date(),
): T[] {
  const key = slateDayKeys(now)[day];
  return events.filter((e) => localDateKey(new Date(e.commenceTime)) === key);
}

export function slateDateLabel(day: SlateDay, now = new Date()): string {
  const d = new Date(now);
  if (day === "tomorrow") d.setDate(d.getDate() + 1);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
