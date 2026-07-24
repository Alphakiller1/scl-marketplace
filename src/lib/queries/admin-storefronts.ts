import "server-only";

import { prisma } from "@/lib/prisma";

export async function getAdminStorefrontRows() {
  return prisma.capperProfile.findMany({
    where: { user: { role: "CAPPER" } },
    select: {
      id: true,
      storefrontStatus: true,
      commercePlatform: true,
      storefrontEnabled: true,
      adminNotes: true,
      lastReviewedAt: true,
      user: {
        select: {
          username: true,
          email: true,
          accountStatus: true,
        },
      },
      packages: {
        select: {
          id: true,
          visibility: true,
          checkoutUrl: true,
          suspendedAt: true,
          trackingUrls: {
            select: {
              _count: { select: { clicks: true } },
            },
          },
        },
      },
      _count: { select: { packages: true } },
    },
    orderBy: [{ storefrontStatus: "asc" }, { updatedAt: "desc" }],
  });
}

export type AdminStorefrontRow = Awaited<
  ReturnType<typeof getAdminStorefrontRows>
>[number];

export async function getAdminStorefrontDetail(capperProfileId: string) {
  return prisma.capperProfile.findUnique({
    where: { id: capperProfileId },
    select: {
      id: true,
      storefrontTitle: true,
      storefrontDescription: true,
      storefrontEnabled: true,
      storefrontStatus: true,
      commercePlatform: true,
      adminNotes: true,
      lastReviewedAt: true,
      lastReviewedBy: {
        select: { username: true, displayName: true },
      },
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          accountStatus: true,
        },
      },
      packages: {
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          priceCents: true,
          billingPeriod: true,
          checkoutUrl: true,
          trialTerms: true,
          displayOrder: true,
          visibility: true,
          affiliatePercent: true,
          approvedAt: true,
          suspendedAt: true,
          suspendedReason: true,
          updatedAt: true,
          trackingUrls: {
            select: {
              slug: true,
              _count: { select: { clicks: true } },
            },
          },
        },
      },
    },
  });
}

export type AdminStorefrontDetail = NonNullable<
  Awaited<ReturnType<typeof getAdminStorefrontDetail>>
>;

export async function getPublicLivePackages(capperProfileId: string) {
  const packages = await prisma.package.findMany({
    where: {
      capperId: capperProfileId,
      visibility: "LIVE",
      suspendedAt: null,
      checkoutUrl: { not: null },
      isActive: true,
    },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      priceCents: true,
      billingPeriod: true,
      trialTerms: true,
      trackingUrls: {
        select: { slug: true },
        take: 1,
      },
    },
  });

  return packages.map((pkg) => ({
    id: pkg.id,
    title: pkg.title,
    description: pkg.description,
    priceCents: pkg.priceCents,
    billingPeriod: pkg.billingPeriod,
    trialTerms: pkg.trialTerms,
    trackingSlug: pkg.trackingUrls[0]?.slug ?? null,
  }));
}

export type PublicLivePackage = Awaited<
  ReturnType<typeof getPublicLivePackages>
>[number];
