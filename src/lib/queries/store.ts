import "server-only";

import type { StoreProvider } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { formatPriceCents } from "@/lib/store-connection";

export type StoreConnectionRow = Awaited<
  ReturnType<typeof listStoreConnections>
>[number];

export async function getCapperProfileIdForUser(userId: string) {
  const profile = await prisma.capperProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return profile?.id ?? null;
}

export async function listConnectionsForCapper(capperId: string) {
  return prisma.storeConnection.findMany({
    where: { capperId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { packages: true } },
    },
  });
}

export async function listStoreConnections(filters?: {
  provider?: StoreProvider | "ALL";
  pendingOnly?: boolean;
}) {
  const provider =
    filters?.provider && filters.provider !== "ALL"
      ? filters.provider
      : undefined;

  return prisma.storeConnection.findMany({
    where: {
      ...(provider ? { provider } : {}),
      ...(filters?.pendingOnly
        ? {
            status: {
              in: ["PENDING_SCL_ACCEPTANCE", "PENDING_SCL_LINK_IMPORT"],
            },
          }
        : {}),
    },
    orderBy: [{ submittedAt: "asc" }, { updatedAt: "desc" }],
    include: {
      capper: {
        select: {
          id: true,
          storefrontTitle: true,
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              displayName: true,
            },
          },
          _count: { select: { packages: true } },
        },
      },
      packages: {
        select: {
          id: true,
          title: true,
          description: true,
          isActive: true,
          checkoutUrl: true,
          priceCents: true,
          billingPeriod: true,
          trackingUrls: {
            select: {
              id: true,
              slug: true,
              _count: { select: { clicks: true } },
            },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function getConnectionById(id: string) {
  return prisma.storeConnection.findUnique({
    where: { id },
    include: {
      capper: {
        select: {
          id: true,
          user: {
            select: { username: true, email: true, displayName: true },
          },
        },
      },
      packages: {
        include: {
          trackingUrls: {
            include: { _count: { select: { clicks: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export type PublicPackageCard = {
  id: string;
  title: string;
  description: string | null;
  priceLabel: string | null;
  provider: StoreProvider | null;
  trackingPath: string;
};

/** Live packages for a public capper profile — CTAs use /go/[slug] only. */
export async function getLivePackagesForCapper(
  capperId: string,
): Promise<PublicPackageCard[]> {
  const packages = await prisma.package.findMany({
    where: {
      capperId,
      isActive: true,
      checkoutUrl: { not: null },
      trackingUrls: { some: {} },
      OR: [
        { storeConnection: { status: "LIVE" } },
        { storeConnectionId: null },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      priceCents: true,
      billingPeriod: true,
      affiliateProvider: true,
      trackingUrls: {
        select: { slug: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  return packages
    .filter((p) => p.trackingUrls[0]?.slug)
    .map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      priceLabel: formatPriceCents(p.priceCents, p.billingPeriod),
      provider: p.affiliateProvider,
      trackingPath: `/go/${p.trackingUrls[0]!.slug}`,
    }));
}

export async function listActiveMarketplacePackages() {
  const packages = await prisma.package.findMany({
    where: {
      isActive: true,
      checkoutUrl: { not: null },
      trackingUrls: { some: {} },
      OR: [
        { storeConnection: { status: "LIVE" } },
        { storeConnectionId: null },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 60,
    select: {
      id: true,
      title: true,
      description: true,
      priceCents: true,
      billingPeriod: true,
      affiliateProvider: true,
      trackingUrls: {
        select: { slug: true },
        take: 1,
        orderBy: { createdAt: "asc" },
      },
      capper: {
        select: {
          user: {
            select: { username: true, displayName: true },
          },
        },
      },
    },
  });

  return packages
    .filter((p) => p.trackingUrls[0]?.slug && p.capper.user.username)
    .map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      priceLabel: formatPriceCents(p.priceCents, p.billingPeriod),
      provider: p.affiliateProvider,
      trackingPath: `/go/${p.trackingUrls[0]!.slug}`,
      capperHandle: p.capper.user.username!,
      capperName:
        p.capper.user.displayName?.trim() ||
        `@${p.capper.user.username!.replace(/^@/, "")}`,
    }));
}
