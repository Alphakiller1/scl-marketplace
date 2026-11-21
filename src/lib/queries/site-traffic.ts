import "server-only";

import { cachedQuery } from "@/lib/cached-query";
import { etYmd } from "@/lib/et-day";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { siteTrafficReport } from "@/lib/site-traffic";

const loadTraffic = cachedQuery(
  async (today: string) => {
    const start = new Date(Date.parse(`${today}T12:00:00Z`) - 29 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const [counts, first] = await Promise.all([
      prisma.siteVisit.groupBy({
        by: ["day"],
        where: { day: { gte: start, lte: today } },
        _count: { _all: true },
      }),
      prisma.siteVisit.findFirst({
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
    ]);
    return siteTrafficReport(
      counts.map((row) => ({ day: row.day, visits: row._count._all })),
      first?.createdAt ?? null,
      new Date(`${today}T12:00:00Z`),
    );
  },
  ["admin-site-traffic-v1"],
  { revalidate: 60 },
);

export async function getAdminSiteTraffic() {
  await requireAdmin();
  try {
    return await loadTraffic(etYmd(new Date()));
  } catch (error) {
    console.error("[site-visits] report unavailable", error);
    return null;
  }
}
