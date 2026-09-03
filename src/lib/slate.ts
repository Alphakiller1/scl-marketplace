/** Local calendar-day helpers for the pick-entry slate (shared by SportPills / OddsAssist / GamePicker). */

/**
 * Which slice of the board the picker is showing.
 *
 * "upcoming" is everything from tomorrow onward, not a single day. The board
 * was capped at today and tomorrow, which quietly decided how far ahead a
 * capper could log: NFL lines are posted weeks out — books publish the whole
 * regular season in August — so a Sunday game could not be logged on Tuesday
 * even though the price was sitting in the feed the whole time.
 *
 * Widening this costs nothing at the provider. The upstream request carries no
 * date bound, so those events were already fetched and paid for, then thrown
 * away at render.
 */
export type SlateDay = "today" | "upcoming";

/** How far past tomorrow the upcoming slate reaches. */
export const UPCOMING_SLATE_DAYS = 14;

/** Local calendar-day key (matches the date the board displays), no time component. */
export function localDateKey(d: Date): string {
  return d.toDateString();
}

function startOfLocalDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/**
 * The local day keys the slate is anchored on: today, and the first day of the
 * upcoming range (tomorrow).
 */
export function slateDayKeys(now = new Date()): Record<SlateDay, string> {
  return {
    today: localDateKey(now),
    upcoming: localDateKey(addDays(now, 1)),
  };
}

/** Events inside the slate window at all — today through the upcoming horizon. */
export function nearTermEvents<T extends { commenceTime: string }>(
  events: readonly T[],
  now = new Date(),
): T[] {
  const horizon = startOfLocalDay(addDays(now, UPCOMING_SLATE_DAYS + 1));
  const dayStart = startOfLocalDay(now);
  return events.filter((e) => {
    const at = new Date(e.commenceTime);
    if (Number.isNaN(at.getTime())) return false;
    return at >= dayStart && at < horizon;
  });
}

export function filterBySlateDay<T extends { commenceTime: string }>(
  events: readonly T[],
  day: SlateDay,
  now = new Date(),
): T[] {
  if (day === "today") {
    const key = localDateKey(now);
    return events.filter((e) => localDateKey(new Date(e.commenceTime)) === key);
  }
  // Everything from tomorrow to the horizon, so a capper can log a game several
  // days out instead of waiting for it to become "tomorrow".
  const from = startOfLocalDay(addDays(now, 1));
  const horizon = startOfLocalDay(addDays(now, UPCOMING_SLATE_DAYS + 1));
  return events.filter((e) => {
    const at = new Date(e.commenceTime);
    if (Number.isNaN(at.getTime())) return false;
    return at >= from && at < horizon;
  });
}

const ET_TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/**
 * Kickoff time in Eastern, for the board rows that label it "ET".
 *
 * `toLocaleTimeString` with no `timeZone` formats in the *viewer's* zone, so a
 * capper outside Eastern read a true local time under a false ET label — from
 * Central every game on the pick board showed an hour before it actually
 * started. Eastern is the platform's canonical zone (grading windows, ledgers
 * and receipts all render in it), so the label was right and the value wrong.
 */
export function etTimeLabel(commenceTime: string): string {
  const at = new Date(commenceTime);
  return Number.isNaN(at.getTime()) ? "—" : ET_TIME_FORMAT.format(at);
}

/** Local day key for grouping upcoming events under date headings. */
export function slateGroupKey(commenceTime: string): string {
  return localDateKey(new Date(commenceTime));
}

/** Heading for one day inside the upcoming list, e.g. "Fri, Aug 14". */
export function slateGroupLabel(commenceTime: string): string {
  return new Date(commenceTime).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Segmented-control sub-label: an exact date for today, a range for upcoming. */
export function slateDateLabel(day: SlateDay, now = new Date()): string {
  if (day === "today") {
    return now.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }
  const from = addDays(now, 1);
  const to = addDays(now, UPCOMING_SLATE_DAYS);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(from)} – ${fmt(to)}`;
}
