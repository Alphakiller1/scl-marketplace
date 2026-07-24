import "server-only";

import { prisma } from "@/lib/prisma";
import {
  calcAffiliateCents,
  resolveAffiliatePercent,
} from "@/lib/commerce-settings";

export async function getPlatformCommerceSettings() {
  return prisma.platformCommerceSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
    select: {
      nativeStoreEnabled: true,
      platformAffiliatePercent: true,
      updatedAt: true,
    },
  });
}

export async function getAdminCapperCommerceRows() {
  return prisma.capperProfile.findMany({
    where: { user: { role: "CAPPER" } },
    select: {
      id: true,
      nativeStoreEnabled: true,
      defaultAffiliatePercent: true,
      storefrontStatus: true,
      user: {
        select: { username: true, email: true },
      },
      _count: { select: { packages: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getAdminSales(limit = 50) {
  return prisma.packageSale.findMany({
    orderBy: { purchasedAt: "desc" },
    take: limit,
    select: {
      id: true,
      source: true,
      status: true,
      grossCents: true,
      affiliateCents: true,
      affiliatePercent: true,
      externalOrderId: true,
      purchasedAt: true,
      notes: true,
      package: {
        select: {
          title: true,
          capper: {
            select: { user: { select: { username: true } } },
          },
        },
      },
      customerUser: {
        select: { email: true, displayName: true },
      },
      clickEvent: {
        select: { id: true, createdAt: true },
      },
    },
  });
}

export async function getSalesPerformanceSummary() {
  const [clicks, sales, packages, settings] = await Promise.all([
    prisma.clickEvent.count(),
    prisma.packageSale.findMany({
      where: { status: { in: ["REPORTED", "CONFIRMED"] } },
      select: {
        grossCents: true,
        affiliateCents: true,
        packageId: true,
      },
    }),
    prisma.package.findMany({
      where: { visibility: "LIVE" },
      select: {
        id: true,
        title: true,
        affiliatePercent: true,
        priceCents: true,
        capper: {
          select: {
            defaultAffiliatePercent: true,
            user: { select: { username: true } },
          },
        },
        trackingUrls: {
          select: { _count: { select: { clicks: true } } },
        },
      },
    }),
    getPlatformCommerceSettings(),
  ]);

  const grossRevenue = sales.reduce((sum, sale) => sum + sale.grossCents, 0);
  const affiliateRevenue = sales.reduce(
    (sum, sale) => sum + (sale.affiliateCents ?? 0),
    0,
  );

  const packageRows = packages.map((pkg) => {
    const clickCount = pkg.trackingUrls.reduce(
      (sum, url) => sum + url._count.clicks,
      0,
    );
    const pkgSales = sales.filter((sale) => sale.packageId === pkg.id);
    const affiliatePercent = resolveAffiliatePercent({
      packagePercent: pkg.affiliatePercent,
      capperPercent: pkg.capper.defaultAffiliatePercent,
      platformPercent: settings.platformAffiliatePercent,
    });
    return {
      packageId: pkg.id,
      title: pkg.title,
      capper: pkg.capper.user.username
        ? `@${pkg.capper.user.username.replace(/^@/, "")}`
        : "Unknown",
      clicks: clickCount,
      sales: pkgSales.length,
      conversionRate: clickCount ? (pkgSales.length / clickCount) * 100 : 0,
      affiliatePercent,
      priceCents: pkg.priceCents,
    };
  });

  return {
    totalClicks: clicks,
    totalSales: sales.length,
    grossRevenueCents: grossRevenue,
    affiliateRevenueCents: affiliateRevenue,
    clickToSaleRate: clicks ? (sales.length / clicks) * 100 : 0,
    packageRows: packageRows.sort((a, b) => b.clicks - a.clicks),
  };
}

export async function resolveSaleAffiliate(input: {
  packageId: string;
  grossCents: number;
  overridePercent?: number | null;
}) {
  const [pkg, settings] = await Promise.all([
    prisma.package.findUnique({
      where: { id: input.packageId },
      select: {
        affiliatePercent: true,
        capper: { select: { defaultAffiliatePercent: true } },
      },
    }),
    getPlatformCommerceSettings(),
  ]);
  if (!pkg) return null;

  const affiliatePercent =
    input.overridePercent ??
    resolveAffiliatePercent({
      packagePercent: pkg.affiliatePercent,
      capperPercent: pkg.capper.defaultAffiliatePercent,
      platformPercent: settings.platformAffiliatePercent,
    });

  return {
    affiliatePercent,
    affiliateCents: calcAffiliateCents(input.grossCents, affiliatePercent),
  };
}

export async function getLivePackagesForSaleEntry() {
  return prisma.package.findMany({
    where: { visibility: "LIVE", checkoutUrl: { not: null } },
    orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      priceCents: true,
      capper: { select: { user: { select: { username: true } } } },
    },
  });
}
