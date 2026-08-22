import type { OddsEvent } from "@/lib/odds-board";
import { expandedBoardMarkets } from "@/lib/odds-verify";

/** Owner priority for sports with per-event expanded boards. */
export const DEFAULT_EXPANDED_SPORT_ORDER = ["MLB", "WNBA", "TENNIS"] as const;

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

/** Markets × one region — the billed cost of one expanded event board. */
export function expandedEventCreditCost(sport: string): number {
  return expandedBoardMarkets(sport).length;
}

/**
 * Parse `expandedOrder=MLB,WNBA,TENNIS`. Unknown sports are dropped; requested
 * expanded sports missing from the list are appended in default order.
 */
export function parseExpandedSportOrder(
  value: string | null | undefined,
  requestedSports: readonly string[],
): string[] {
  const wanted = new Set(
    requestedSports
      .map((sport) => sport.trim().toUpperCase())
      .filter((sport) =>
        (DEFAULT_EXPANDED_SPORT_ORDER as readonly string[]).includes(sport),
      ),
  );
  const listed = (value ?? "")
    .split(",")
    .map((sport) => sport.trim().toUpperCase())
    .filter((sport) => wanted.has(sport));
  const ordered = [...new Set(listed)];
  for (const sport of DEFAULT_EXPANDED_SPORT_ORDER) {
    if (wanted.has(sport) && !ordered.includes(sport)) ordered.push(sport);
  }
  return ordered;
}

export function laterExpandedCreditReserve(
  later: readonly { sport: string; events: number }[],
): number {
  return later.reduce(
    (sum, row) => sum + row.events * expandedEventCreditCost(row.sport),
    0,
  );
}

/**
 * Stop the current expanded sport so later expanded boards (and the circuit
 * reserve) still fit. `remaining == null` means no provider response yet.
 */
export function shouldHoldCreditsForLater(
  remaining: number | null,
  nextCost: number,
  laterCredits: number,
  reserve: number,
): boolean {
  if (remaining == null || laterCredits <= 0) return false;
  return remaining - nextCost < laterCredits + reserve;
}
