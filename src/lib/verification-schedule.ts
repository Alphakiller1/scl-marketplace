const EASTERN_ZONE = "America/New_York";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type EasternParts = {
  date: string;
  weekday: number;
  minutes: number;
};

function easternParts(value: Date): EasternParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: Math.max(0, WEEKDAYS.indexOf(get("weekday"))),
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

/** Convert an owner-entered Eastern calendar date/time to its UTC instant. */
export function easternLocalToUtc(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return null;
  }
  const [hour, minute] = time.split(":").map(Number);
  if (hour! > 23 || minute! > 59) return null;
  const center = Date.parse(`${date}T12:00:00.000Z`);
  for (let offset = -18 * 60; offset <= 18 * 60; offset += 1) {
    const candidate = new Date(center + offset * 60_000);
    const parts = easternParts(candidate);
    if (parts.date === date && parts.minutes === hour! * 60 + minute!) {
      return candidate;
    }
  }
  return null;
}

export function nextRecurringVerificationAt(input: {
  after: Date;
  timeOfDayMinutes: number;
  daysOfWeek: readonly number[];
}): Date | null {
  const allowed = new Set(
    input.daysOfWeek.length ? input.daysOfWeek : [0, 1, 2, 3, 4, 5, 6],
  );
  const start = new Date(input.after);
  start.setUTCSeconds(0, 0);
  for (let minute = 1; minute <= 8 * 24 * 60; minute += 1) {
    const candidate = new Date(start.getTime() + minute * 60_000);
    const parts = easternParts(candidate);
    if (
      parts.minutes === input.timeOfDayMinutes &&
      allowed.has(parts.weekday)
    ) {
      return candidate;
    }
  }
  return null;
}

export function scheduledVerificationEstimate(input: {
  markets: readonly string[];
  maxEvents: number;
  surfaceCompetitionCount?: number;
}): number {
  return (
    new Set(input.markets).size * input.maxEvents +
    Math.max(1, input.surfaceCompetitionCount ?? 1) * 3
  );
}
