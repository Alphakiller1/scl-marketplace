import { etYmd } from "@/lib/et-day";

const easternHour = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  hourCycle: "h23",
});

export type DailyDeadlineCandidate = {
  eventStartsAt: Date | null;
  createdAt: Date;
  parlayId: string | null;
};

/** Deadlines belong to the day AFTER the event's Eastern calendar slate. */
export function slateDeadlines(slateDate: string) {
  const nextNoon = new Date(`${slateDate}T12:00:00Z`);
  nextNoon.setUTCDate(nextNoon.getUTCDate() + 1);
  // Both deadlines are after the DST transition. Noon UTC has the same offset
  // as 5/7 a.m., including the 23-hour and 25-hour clock-change days.
  const offsetHours = 12 - Number(easternHour.format(nextNoon));
  const at = (hour: number) => {
    const value = new Date(nextNoon);
    value.setUTCHours(hour + offsetHours, 0, 0, 0);
    return value;
  };
  return { targetAt: at(5), deadlineAt: at(7) };
}

export function isOvernightGradingRecovery(now: Date): boolean {
  const hour = Number(easternHour.format(now));
  return hour >= 3 && hour < 7;
}

export function dailyDeadlineState<T extends DailyDeadlineCandidate>(
  plays: readonly T[],
  now: Date,
) {
  const today = etYmd(now);
  const deadlines = new Map<string, ReturnType<typeof slateDeadlines>>();
  const getDeadlines = (day: string) => {
    let value = deadlines.get(day);
    if (!value) {
      value = slateDeadlines(day);
      deadlines.set(day, value);
    }
    return value;
  };
  // Missing schedule metadata is an operational exception, never permission to
  // invent a result. Its publication date prevents it disappearing from ops.
  const previousSlate = plays.filter(
    (play) => etYmd(play.eventStartsAt ?? play.createdAt) < today,
  );
  const targetMisses = previousSlate.filter(
    (play) =>
      getDeadlines(etYmd(play.eventStartsAt ?? play.createdAt)).targetAt <= now,
  );
  const deadlineMisses = previousSlate.filter(
    (play) =>
      getDeadlines(etYmd(play.eventStartsAt ?? play.createdAt)).deadlineAt <=
      now,
  );
  return {
    previousSlate,
    targetMisses,
    deadlineMisses,
    summary: {
      timeZone: "America/New_York" as const,
      target: "05:00" as const,
      deadline: "07:00" as const,
      status:
        deadlineMisses.length > 0
          ? ("BREACHED" as const)
          : targetMisses.length > 0
            ? ("RECOVERY" as const)
            : previousSlate.length > 0
              ? ("DUE" as const)
              : ("CLEAR" as const),
      pending: previousSlate.length,
      straightPlays: previousSlate.filter((play) => play.parlayId === null)
        .length,
      parlayLegs: previousSlate.filter((play) => play.parlayId !== null).length,
      affectedParlays: new Set(
        previousSlate.flatMap((play) => (play.parlayId ? [play.parlayId] : [])),
      ).size,
      missingSchedule: previousSlate.filter((play) => !play.eventStartsAt)
        .length,
      pastTarget: targetMisses.length,
      pastDeadline: deadlineMisses.length,
    },
  };
}

export type DailyGradingDeadline = ReturnType<
  typeof dailyDeadlineState
>["summary"];
