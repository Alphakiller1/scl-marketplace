const SCL_OPERATIONS_TIME_ZONE = "America/New_York";

const adminBroadcastDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SCL_OPERATIONS_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

/**
 * Campaign history is server-rendered, so use SCL's operating time zone rather
 * than the Vercel function's UTC locale. Explicit date/time components are
 * required because Intl forbids combining dateStyle/timeStyle with
 * timeZoneName.
 */
export function formatAdminBroadcastDate(date: Date): string {
  return adminBroadcastDateTimeFormatter.format(date);
}
