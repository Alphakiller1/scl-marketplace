import { UPCOMING_SLATE_DAYS } from "@/lib/slate";

/** Paid surface boards only cover the slate the picker can show. */
export const SURFACE_HORIZON_DAYS = UPCOMING_SLATE_DAYS;

function toOddsApiTime(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function surfaceCommenceBounds(now = new Date()): {
  from: string;
  to: string;
} {
  return {
    from: toOddsApiTime(now),
    to: toOddsApiTime(
      new Date(now.getTime() + SURFACE_HORIZON_DAYS * 86_400_000),
    ),
  };
}

/** Query params that keep a sport-level odds call inside the 14-day slate. */
export function surfaceCommenceQuery(now = new Date()): string {
  const { from, to } = surfaceCommenceBounds(now);
  return `commenceTimeFrom=${encodeURIComponent(from)}&commenceTimeTo=${encodeURIComponent(to)}`;
}
