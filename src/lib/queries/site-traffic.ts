import "server-only";

import { withTransientDatabaseRetry } from "@/lib/database-retry";
import { etYmd } from "@/lib/et-day";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { siteTrafficReport } from "@/lib/site-traffic";

export async function getAdminSiteTraffic() {
  await requireAdmin();
  const now = new Date();
  const today = etYmd(now);
  const start = new Date(Date.parse(`${today}T12:00:00Z`) - 29 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  try {
    const [counts, first] = await withTransientDatabaseRetry(
      () =>
        Promise.all([
          prisma.siteVisit.groupBy({
            by: ["day"],
            where: { day: { gte: start, lte: today } },
            _count: { _all: true },
          }),
          prisma.siteVisit.findFirst({
            orderBy: { createdAt: "asc" },
            select: { createdAt: true },
          }),
        ]),
      { label: "admin website visits", maxAttempts: 2 },
    );
    return siteTrafficReport(
      counts.map((row) => ({ day: row.day, visits: row._count._all })),
      first?.createdAt ?? null,
      now,
    );
  } catch (error) {
    console.error("[site-visits] report unavailable", error);
    return null;
  }
}
