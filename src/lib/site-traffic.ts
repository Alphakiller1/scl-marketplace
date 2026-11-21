import { etYmd } from "@/lib/et-day";

export const SITE_VISIT_COOKIE = "scl-visit";
export const SITE_VISIT_SECONDS = 30 * 60;
export const SITE_TRAFFIC_REFRESH_MS = 60_000;

/** Track rendered website pages, excluding operational and redirect routes. */
export function isSiteVisitPath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//") || /[?#\\]/.test(path)) {
    return false;
  }
  return !["admin", "api", "_next", "go", "qa"].includes(
    path.split("/")[1].toLowerCase(),
  );
}

export function isSiteVisitBrowser(headers: Headers): boolean {
  const agent = headers.get("user-agent") ?? "";
  return (
    /Mozilla\/5\.0/i.test(agent) &&
    !/bot|crawl|spider|headless|lighthouse|preview|facebookexternalhit/i.test(
      agent,
    ) &&
    !/prefetch/i.test(
      `${headers.get("purpose") ?? ""} ${headers.get("sec-purpose") ?? ""}`,
    ) &&
    headers.get("next-router-prefetch") !== "1"
  );
}

export function siteTrafficReport(
  counts: readonly { day: string; visits: number }[],
  firstVisitAt: Date | null,
  now = new Date(),
) {
  const today = etYmd(now);
  const firstDay = firstVisitAt ? etYmd(firstVisitAt) : null;
  const byDay = new Map(counts.map((row) => [row.day, row.visits]));
  const anchor = Date.parse(`${today}T12:00:00Z`);
  const days = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(anchor - (29 - index) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    return {
      date,
      visits: firstDay && date >= firstDay ? (byDay.get(date) ?? 0) : null,
    };
  });
  return {
    days,
    today: days.at(-1)?.visits ?? 0,
    yesterday: days.at(-2)?.visits ?? null,
    last7Days: days.slice(-7).reduce((sum, day) => sum + (day.visits ?? 0), 0),
    firstDay,
    checkedAt: now.toISOString(),
  };
}

export type SiteTrafficReport = ReturnType<typeof siteTrafficReport>;
