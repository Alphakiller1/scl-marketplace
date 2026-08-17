/**
 * Eastern Time calendar-day bounds for public reporting (ticker, etc.).
 */

const ET = "America/New_York";

function etYmd(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ET }).format(date);
}

/** UTC instant when an ET calendar day (YYYY-MM-DD) begins. */
function startOfEtYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d, 0, 0, 0);
  for (let offsetH = -30; offsetH <= 30; offsetH++) {
    const candidate = new Date(base + offsetH * 3_600_000);
    if (etYmd(candidate) === ymd) {
      const hour = Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: ET,
          hour: "numeric",
          hour12: false,
        }).format(candidate),
      );
      if (hour === 0) return candidate;
    }
  }
  return new Date(base + 5 * 3_600_000);
}

/**
 * Inclusive start / exclusive end for an ET calendar day.
 * `dayOffset` 0 = today ET, -1 = yesterday ET.
 */
export function etDayBounds(
  dayOffset = 0,
  now = new Date(),
): { start: Date; end: Date } {
  const [anchorY, anchorM, anchorD] = etYmd(now).split("-").map(Number);
  const ymd = new Date(Date.UTC(anchorY, anchorM - 1, anchorD + dayOffset))
    .toISOString()
    .slice(0, 10);
  const start = startOfEtYmd(ymd);
  const [y, m, d] = ymd.split("-").map(Number);
  const endYmd = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  const end = startOfEtYmd(endYmd);
  return { start, end };
}
