import "server-only";

import type {
  AccountStatus,
  Prisma,
  StoreConnectionStatus,
} from "@prisma/client";

import {
  ADMIN_CAPPERS_PAGE_SIZE,
  type AdminCapperFilters,
} from "@/lib/admin-cappers";
import { prisma } from "@/lib/prisma";

const PENDING_STOREFRONT_STATUSES: StoreConnectionStatus[] = [
  "PENDING_SCL_ACCEPTANCE",
  "PENDING_SCL_LINK_IMPORT",
];
const ATTENTION_STOREFRONT_STATUSES: StoreConnectionStatus[] = [
  "NEEDS_ACTION",
  "DISABLED",
];

function adminCapperWhere(filters: AdminCapperFilters): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [{ role: "CAPPER" }];

  if (filters.search) {
    and.push({
      OR: [
        {
          username: { contains: filters.search, mode: "insensitive" },
        },
        {
          displayName: { contains: filters.search, mode: "insensitive" },
        },
        {
          email: { contains: filters.search, mode: "insensitive" },
        },
      ],
    });
  }

  if (filters.status !== "all") {
    and.push({
      accountStatus: filters.status.toUpperCase() as AccountStatus,
    });
  }
  if (filters.verification !== "all") {
    and.push({
      emailVerified: filters.verification === "verified" ? { not: null } : null,
    });
  }
  if (filters.scope !== "all") {
    and.push({ isTest: filters.scope === "test" });
  }

  if (filters.storefront === "none") {
    and.push({
      OR: [
        { capperProfile: { is: null } },
        {
          capperProfile: {
            is: { storeConnections: { none: {} } },
          },
        },
      ],
    });
  } else if (filters.storefront !== "all") {
    const statuses =
      filters.storefront === "pending"
        ? PENDING_STOREFRONT_STATUSES
        : filters.storefront === "attention"
          ? ATTENTION_STOREFRONT_STATUSES
          : (["LIVE"] as StoreConnectionStatus[]);
    and.push({
      capperProfile: {
        is: {
          storeConnections: {
            some: { status: { in: statuses } },
          },
        },
      },
    });
  }

  return { AND: and };
}

export async function getAdminCapperAccounts(filters: AdminCapperFilters) {
  const where = adminCapperWhere(filters);
  const total = await prisma.user.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_CAPPERS_PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);

  const rows = await prisma.user.findMany({
    where,
    select: {
      id: true,
      displayName: true,
      username: true,
      email: true,
      emailVerified: true,
      accountStatus: true,
      isTest: true,
      createdAt: true,
      capperProfile: {
        select: {
          sports: true,
          isLegacy: true,
          storefrontEnabled: true,
          _count: {
            select: {
              plays: true,
              parlays: true,
            },
          },
          storeConnections: {
            select: {
              id: true,
              provider: true,
              status: true,
              packageImportStatus: true,
              updatedAt: true,
            },
            orderBy: { updatedAt: "desc" },
          },
          plays: {
            select: { createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * ADMIN_CAPPERS_PAGE_SIZE,
    take: ADMIN_CAPPERS_PAGE_SIZE,
  });

  return { rows, total, page, totalPages };
}

export async function getAdminCapperDetail(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, role: "CAPPER" },
    select: {
      id: true,
      displayName: true,
      username: true,
      email: true,
      emailVerified: true,
      accountStatus: true,
      isTest: true,
      createdAt: true,
      updatedAt: true,
      termsAcceptances: {
        select: {
          id: true,
          policyVersion: true,
          acceptedAt: true,
        },
        orderBy: { acceptedAt: "desc" },
        take: 5,
      },
      statusChanges: {
        select: {
          id: true,
          previousStatus: true,
          newStatus: true,
          reason: true,
          createdAt: true,
          changedBy: {
            select: {
              displayName: true,
              username: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      capperProfile: {
        select: {
          id: true,
          headline: true,
          bio: true,
          specialties: true,
          sports: true,
          books: true,
          betTypes: true,
          dailyVolume: true,
          writtenAnalysis: true,
          providerType: true,
          isLegacy: true,
          storefrontTitle: true,
          storefrontDescription: true,
          storefrontEnabled: true,
          updatedAt: true,
          packages: {
            select: {
              id: true,
              title: true,
              priceCents: true,
              billingPeriod: true,
              isActive: true,
              sortOrder: true,
              affiliateProvider: true,
              updatedAt: true,
              trackingUrls: {
                select: {
                  _count: { select: { clicks: true } },
                },
              },
            },
            orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
          },
          storeConnections: {
            select: {
              id: true,
              provider: true,
              status: true,
              packageImportStatus: true,
              submittedAt: true,
              adminNotes: true,
              updatedAt: true,
              _count: { select: { packages: true } },
            },
            orderBy: { updatedAt: "desc" },
          },
          plays: {
            where: { parlayId: null },
            select: {
              id: true,
              sport: true,
              market: true,
              selection: true,
              outcome: true,
              profitUnits: true,
              needsReview: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 8,
          },
          parlays: {
            select: {
              id: true,
              outcome: true,
              profitUnits: true,
              createdAt: true,
              _count: { select: { legs: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      },
    },
  });

  if (!user?.capperProfile) return user ? { ...user, summary: null } : null;

  const [straightSummary, parlaySummary] = await Promise.all([
    prisma.play.aggregate({
      where: { capperId: user.capperProfile.id, parlayId: null },
      _count: { _all: true },
      _sum: { profitUnits: true },
    }),
    prisma.parlay.aggregate({
      where: { capperId: user.capperProfile.id },
      _count: { _all: true },
      _sum: { profitUnits: true },
    }),
  ]);

  return {
    ...user,
    summary: {
      straightCount: straightSummary._count._all,
      parlayCount: parlaySummary._count._all,
      netUnits:
        Number(straightSummary._sum.profitUnits ?? 0) +
        Number(parlaySummary._sum.profitUnits ?? 0),
      packageCount: user.capperProfile.packages.length,
      clickCount: user.capperProfile.packages.reduce(
        (total, pkg) =>
          total +
          pkg.trackingUrls.reduce(
            (packageTotal, url) => packageTotal + url._count.clicks,
            0,
          ),
        0,
      ),
    },
  };
}

export type AdminCapperAccount = Awaited<
  ReturnType<typeof getAdminCapperAccounts>
>["rows"][number];

export type AdminCapperDetail = NonNullable<
  Awaited<ReturnType<typeof getAdminCapperDetail>>
>;
