import "server-only";

import { prisma } from "@/lib/prisma";

export async function getAdminClickAnalytics(limit = 20) {
  const [totals, byPackage, recent] = await Promise.all([
    prisma.clickEvent.count(),
    prisma.package.findMany({
      where: {
        visibility: "LIVE",
        trackingUrls: { some: {} },
      },
      select: {
        id: true,
        title: true,
        capper: {
          select: {
            user: { select: { username: true } },
          },
        },
        trackingUrls: {
          select: {
            slug: true,
            _count: { select: { clicks: true } },
          },
        },
      },
      take: limit,
    }),
    prisma.clickEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        createdAt: true,
        referrer: true,
        trackingUrl: {
          select: {
            slug: true,
            package: {
              select: {
                title: true,
                capper: {
                  select: { user: { select: { username: true } } },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const packageRows = byPackage
    .map((pkg) => {
      const clicks = pkg.trackingUrls.reduce(
        (sum, url) => sum + url._count.clicks,
        0,
      );
      return {
        packageId: pkg.id,
        title: pkg.title,
        capper: pkg.capper.user.username
          ? `@${pkg.capper.user.username.replace(/^@/, "")}`
          : "Unknown",
        slug: pkg.trackingUrls[0]?.slug ?? "—",
        clicks,
      };
    })
    .sort((a, b) => b.clicks - a.clicks);

  return {
    totalClicks: totals,
    packageRows,
    recentClicks: recent.map((row) => ({
      createdAt: row.createdAt,
      referrer: row.referrer,
      slug: row.trackingUrl.slug,
      packageTitle: row.trackingUrl.package.title,
      capper: row.trackingUrl.package.capper.user.username
        ? `@${row.trackingUrl.package.capper.user.username.replace(/^@/, "")}`
        : "Unknown",
    })),
  };
}
