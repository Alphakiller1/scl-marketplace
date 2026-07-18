/**
 * Short capture clock for slip rows — "Captured HH:MM ET".
 * Prefer an ISO capture timestamp; never invent a fake server stamp.
 */
export function formatCapturedHmEt(iso?: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `Captured ${get("hour")}:${get("minute")} ET`;
}
