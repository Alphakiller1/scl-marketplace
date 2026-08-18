import type { OddsEvent } from "@/lib/odds-board";

export type ExpandedSlateDay = "today" | "tomorrow";

const ET_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function etDay(date: Date): string {
  return ET_DAY.format(date);
}

export function parseExpandedSlateDays(value: string): ExpandedSlateDay[] {
  const days = value
    .split(",")
    .map((day) => day.trim().toLowerCase())
    .filter(
      (day): day is ExpandedSlateDay => day === "today" || day === "tomorrow",
    );
  return [...new Set(days)];
}

/** Select only the ET slate days that should receive metered event markets. */
export function selectExpandedSlateEvents(
  events: readonly OddsEvent[],
  days: readonly ExpandedSlateDay[],
  now = new Date(),
): OddsEvent[] {
  const allowed = new Set<string>();
  if (days.includes("today")) allowed.add(etDay(now));
  if (days.includes("tomorrow")) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    allowed.add(etDay(tomorrow));
  }
  return events.filter(
    (event) =>
      Date.parse(event.commenceTime) > now.getTime() &&
      allowed.has(etDay(new Date(event.commenceTime))),
  );
}

/**
 * Merge a successful surface response over the durable board.
 *
 * The provider can omit one future fixture from an otherwise successful
 * response. Retaining prior future events makes the manual writer follow the
 * same last-known-good contract as the live cache path.
 */
export function mergeLastGoodBoardEvents(
  fresh: readonly OddsEvent[],
  prior: readonly OddsEvent[],
  now = new Date(),
): OddsEvent[] {
  const freshIds = new Set(fresh.map((event) => event.id));
  return [
    ...fresh,
    ...prior.filter(
      (event) =>
        !freshIds.has(event.id) &&
        Date.parse(event.commenceTime) > now.getTime() &&
        event.selections.length > 0,
    ),
  ].sort((a, b) => Date.parse(a.commenceTime) - Date.parse(b.commenceTime));
}
