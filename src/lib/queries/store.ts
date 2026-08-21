import "server-only";

import type { StoreProvider } from "@prisma/client";

import { withTransientDatabaseRetry } from "@/lib/database-retry";
import { prisma } from "@/lib/prisma";
import { prismaExcludeTestHandlesLive } from "@/lib/public-eligibility-prisma";
import {
  activePublicPackageWhere,
  isPackagePubliclyPublishable,
  publicPackagePublicationWhere,
} from "@/lib/public-packages";
import { formatPriceCents } from "@/lib/store-connection";
import {
  furthestStorefrontStatus,
  storefrontCoverageBucket,
} from "@/lib/storefront-review";
import type { PublicMarketplaceCapper } from "@/lib/marketplace-search";
import {
  inspectLegacyPackageLineage,
  inspectLegacyPackageIntegrity,
  LEGACY_SOURCE_OFFER_COUNT,
  loadLegacyPackageIntegrityRows,
} from "@/lib/legacy-package-integrity";

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

export async function countStoreConnectionsRequiringAttention() {
  try {
    return await prisma.storeConnection.count({
      where: { requiresAttention: true },
    });
  } catch (error) {
    console.error(
      "[countStoreConnectionsRequiringAttention] database unavailable:",
      error,
    );
    return 0;
  }
}

/** Live owner-facing inventory and invariant report for every legacy offer. */
export async function getLegacyPackageIntegrityForAdmin() {
  try {
    const rows = await loadLegacyPackageIntegrityRows(prisma);
    const lifecycleEvents = await prisma.packageAuditEvent.findMany({
      where: {
        capper: { isLegacy: true },
        action: { in: ["CREATED", "DELETED"] },
      },
      select: { action: true },
    });
    const report = inspectLegacyPackageIntegrity(rows);
    const lineage = inspectLegacyPackageLineage(rows.length, lifecycleEvents);
    return {
      ...report,
      errors: [...report.errors, ...lineage.errors],
      lineage,
      failed: false,
      whopPackages: rows
        .filter((row) => row.affiliateProvider === "WHOP")
        .map((row) => ({
          id: row.id,
          userId: row.userId,
          username: row.username,
          title: row.title,
          priceLabel:
            formatPriceCents(row.priceCents, row.billingPeriod) ??
            "Price shown by provider",
          active: row.isActive,
          publicEligible:
            row.isActive &&
            Boolean(row.checkoutUrl) &&
            row.trackingUrls.length === 1 &&
            (row.connectionStatus === null || row.connectionStatus === "LIVE"),
          source: row.externalProductId ? "Whop API" : "Manual / legacy",
          trackingIntact:
            row.trackingUrls.length === 1 &&
            row.trackingUrls[0]?.targetUrl === row.checkoutUrl,
        })),
    };
  } catch (error) {
    console.error("[getLegacyPackageIntegrityForAdmin] failed:", error);
    return {
      failed: true,
      stats: {
        total: 0,
        active: 0,
        publicEligible: 0,
        whop: 0,
        activeWhop: 0,
        apiSynced: 0,
        manualOrCarried: 0,
      },
      errors: ["Could not read the legacy package inventory."],
      warnings: [],
      lineage: {
        sourceTotal: LEGACY_SOURCE_OFFER_COUNT,
        created: 0,
        deleted: 0,
        expectedTotal: LEGACY_SOURCE_OFFER_COUNT,
        currentTotal: 0,
        errors: ["Could not verify legacy package lineage."],
      },
      whopPackages: [],
    };
  }
}

export async function listConnectionsForCapper(capperId: string) {
  try {
    return await prisma.storeConnection.findMany({
      where: { capperId },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { packages: true } },
      },
    });
  } catch (error) {
    console.error("[listConnectionsForCapper] database unavailable:", error);
    return [];
  }
}

export async function listStoreConnections(filters?: {
  provider?: StoreProvider | "ALL";
  pendingOnly?: boolean;
  requiresAttentionOnly?: boolean;
}) {
  const provider =
    filters?.provider && filters.provider !== "ALL"
      ? filters.provider
      : undefined;

  try {
    return await prisma.storeConnection.findMany({
      where: {
        ...(provider ? { provider } : {}),
        ...(filters?.pendingOnly
          ? {
              status: {
                in: ["PENDING_SCL_ACCEPTANCE", "PENDING_SCL_LINK_IMPORT"],
              },
            }
          : {}),
        ...(filters?.requiresAttentionOnly ? { requiresAttention: true } : {}),
      },
      orderBy: [
        { requiresAttention: "desc" },
        { submittedAt: "asc" },
        { updatedAt: "desc" },
      ],
      include: {
        reviewedBy: {
          select: {
            displayName: true,
            username: true,
            email: true,
          },
        },
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
            promoOffer: true,
            isActive: true,
            checkoutUrl: true,
            priceCents: true,
            billingPeriod: true,
            billingIntervalCount: true,
            sortOrder: true,
            trackingUrls: {
              select: {
                id: true,
                slug: true,
                _count: { select: { clicks: true } },
              },
              take: 1,
            },
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        },
      },
    });
  } catch (error) {
    console.error("[listStoreConnections] database unavailable:", error);
    return [];
  }
}

export async function getStorefrontReviewHistory(storeConnectionId: string) {
  return prisma.storefrontReviewEvent.findMany({
    where: { storeConnectionId },
    select: {
      id: true,
      action: true,
      previousStatus: true,
      newStatus: true,
      reason: true,
      adminNotes: true,
      createdAt: true,
      reviewedBy: {
        select: {
          displayName: true,
          username: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 25,
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
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      },
    },
  });
}

export type PublicPackageCard = {
  id: string;
  title: string;
  description: string | null;
  promoOffer: string | null;
  priceLabel: string | null;
  provider: StoreProvider | null;
  trackingPath: string;
};

export type PublicMarketplacePackage = PublicPackageCard & {
  capperId: string;
  capperHandle: string;
  capperName: string;
};

export async function listPublicMarketplaceCappersResult(): Promise<{
  cappers: PublicMarketplaceCapper[];
  failed: boolean;
}> {
  try {
    const excludeTest = await prismaExcludeTestHandlesLive();
    const profiles = await withTransientDatabaseRetry(
      () =>
        prisma.capperProfile.findMany({
          where: {
            user: {
              username: { not: null },
              accountStatus: "ACTIVE",
              ...excludeTest,
            },
          },
          select: {
            id: true,
            avatarUrl: true,
            user: {
              select: { username: true, displayName: true },
            },
          },
        }),
      { label: "public marketplace capper directory" },
    );

    return {
      cappers: profiles
        .filter((profile) => profile.user.username)
        .map((profile) => ({
          id: profile.id,
          handle: profile.user.username!,
          name:
            profile.user.displayName?.trim() ||
            `@${profile.user.username!.replace(/^@/, "")}`,
          avatarUrl: profile.avatarUrl,
        }))
        .sort((a, b) => a.handle.localeCompare(b.handle)),
      failed: false,
    };
  } catch (error) {
    console.error(
      "[listPublicMarketplaceCappers] database unavailable:",
      error,
    );
    return { cappers: [], failed: true };
  }
}

/** Live packages for a public capper profile — CTAs use /go/[slug] only. */
async function queryLivePackagesForCapper(
  capperId: string,
  publication: "public" | "owner",
): Promise<PublicPackageCard[]> {
  try {
    const excludeTest =
      publication === "public"
        ? await prismaExcludeTestHandlesLive()
        : undefined;
    const packages = await prisma.package.findMany({
      where: {
        capperId,
        ...(publication === "public" && excludeTest
          ? publicPackagePublicationWhere(excludeTest)
          : activePublicPackageWhere),
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        promoOffer: true,
        priceCents: true,
        billingPeriod: true,
        billingIntervalCount: true,
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
        promoOffer: p.promoOffer,
        priceLabel: formatPriceCents(
          p.priceCents,
          p.billingPeriod,
          p.billingIntervalCount,
        ),
        provider: p.affiliateProvider,
        trackingPath: `/go/${p.trackingUrls[0]!.slug}`,
      }));
  } catch (error) {
    console.error("[queryLivePackagesForCapper] database unavailable:", error);
    return [];
  }
}

/** Live packages for a public capper profile; CTAs use /go/[slug] only. */
export async function getLivePackagesForCapper(
  capperId: string,
): Promise<PublicPackageCard[]> {
  return queryLivePackagesForCapper(capperId, "public");
}

/** Owner dashboard view; test-account owners may inspect their own offers. */
export async function getOwnerLivePackagesForCapper(
  capperId: string,
): Promise<PublicPackageCard[]> {
  return queryLivePackagesForCapper(capperId, "owner");
}

export async function listActiveMarketplacePackagesResult(): Promise<{
  packages: PublicMarketplacePackage[];
  failed: boolean;
}> {
  try {
    const excludeTest = await prismaExcludeTestHandlesLive();
    const packages = await withTransientDatabaseRetry(
      () =>
        prisma.package.findMany({
          where: {
            ...publicPackagePublicationWhere(excludeTest),
          },
          orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
          select: {
            id: true,
            title: true,
            description: true,
            promoOffer: true,
            priceCents: true,
            billingPeriod: true,
            billingIntervalCount: true,
            affiliateProvider: true,
            trackingUrls: {
              select: { slug: true },
              take: 1,
              orderBy: { createdAt: "asc" },
            },
            capper: {
              select: {
                id: true,
                user: {
                  select: { username: true, displayName: true },
                },
              },
            },
          },
        }),
      { label: "public marketplace packages" },
    );

    return {
      packages: packages
        .filter((p) => p.trackingUrls[0]?.slug && p.capper.user.username)
        .map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          promoOffer: p.promoOffer,
          priceLabel: formatPriceCents(
            p.priceCents,
            p.billingPeriod,
            p.billingIntervalCount,
          ),
          provider: p.affiliateProvider,
          trackingPath: `/go/${p.trackingUrls[0]!.slug}`,
          capperId: p.capper.id,
          capperHandle: p.capper.user.username!,
          capperName:
            p.capper.user.displayName?.trim() ||
            `@${p.capper.user.username!.replace(/^@/, "")}`,
        })),
      failed: false,
    };
  } catch (error) {
    console.error(
      "[listActiveMarketplacePackages] database unavailable:",
      error,
    );
    return { packages: [], failed: true };
  }
}

export async function listActiveMarketplacePackages(): Promise<
  PublicMarketplacePackage[]
> {
  return (await listActiveMarketplacePackagesResult()).packages;
}

// ── Admin storefront pipeline: alerting + roster coverage ────────────────────

const GHOST_DOMAIN = "@ghost.scl.demo";

/**
 * Submissions waiting on SCL — drives the admin nav badge + overview stat.
 * A capper confirming their Winible/Whop affiliate steps must be impossible
 * for admins to miss: this counts every connection pending SCL action or
 * explicitly flagged for attention.
 */
export async function countStorefrontQueue(): Promise<number> {
  try {
    return await prisma.storeConnection.count({
      where: {
        // Never alert on demo data — matches getStorefrontCoverage.
        capper: {
          user: { NOT: { email: { endsWith: GHOST_DOMAIN } } },
        },
        OR: [
          {
            status: {
              in: ["PENDING_SCL_ACCEPTANCE", "PENDING_SCL_LINK_IMPORT"],
            },
          },
          { requiresAttention: true },
        ],
      },
    });
  } catch (error) {
    console.error("[countStorefrontQueue] database unavailable:", error);
    return 0;
  }
}

export type StorefrontCoverageEntry = {
  capperId: string;
  /** User id — admin capper page target for cappers with no connection yet. */
  userId: string;
  /** Furthest connection's id — links straight to its approval screen. */
  connectionId: string | null;
  handle: string | null;
  displayName: string | null;
  email: string;
  provider: StoreProvider | null;
  status: string | null;
  submittedAt: Date | null;
  /**
   * Live offers carried over from the previous platform, which have no
   * connection behind them. Non-zero means the storefront is already public and
   * earning even when `status` is null.
   */
  carriedLivePackages: number;
};

export type StorefrontCoverage = {
  /** Storefront live on the marketplace — SCL is earning. */
  live: StorefrontCoverageEntry[];
  /** Capper says done; awaiting SCL acceptance / link import / go-live. */
  pipeline: StorefrontCoverageEntry[];
  /** Chose a provider but never submitted — likely has a storefront, not synced. */
  stalled: StorefrontCoverageEntry[];
  /** No storefront connection at all — market Winible onboarding to them. */
  neverStarted: StorefrontCoverageEntry[];
  /** Needs-action or suspended — revenue currently blocked. */
  blocked: StorefrontCoverageEntry[];
  failed: boolean;
};

const EMPTY_COVERAGE: StorefrontCoverage = {
  live: [],
  pipeline: [],
  stalled: [],
  neverStarted: [],
  blocked: [],
  failed: true,
};

/**
 * Every real, active capper bucketed by storefront-revenue state so admins can
 * see who is earning, who is waiting on SCL, who stalled mid-setup, and who has
 * never started (the outreach list). Ghost demo accounts are excluded — this is
 * an operations view, not a public surface.
 */
export async function getStorefrontCoverage(): Promise<StorefrontCoverage> {
  try {
    const cappers = await prisma.capperProfile.findMany({
      where: {
        user: { accountStatus: "ACTIVE" },
        NOT: { user: { email: { endsWith: GHOST_DOMAIN } } },
      },
      select: {
        id: true,
        user: {
          select: { id: true, username: true, displayName: true, email: true },
        },
        storeConnections: {
          select: {
            id: true,
            provider: true,
            status: true,
            submittedAt: true,
          },
        },
        // Carried-over offers: live to the public, but attached to no connection.
        packages: {
          where: { ...activePublicPackageWhere, storeConnectionId: null },
          select: { id: true, affiliateProvider: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const coverage: StorefrontCoverage = {
      live: [],
      pipeline: [],
      stalled: [],
      neverStarted: [],
      blocked: [],
      failed: false,
    };

    for (const capper of cappers) {
      const furthest = furthestStorefrontStatus(
        capper.storeConnections.map((c) => c.status),
      );
      const best =
        capper.storeConnections.find((c) => c.status === furthest) ?? null;
      const carriedLivePackages = capper.packages.length;
      const entry: StorefrontCoverageEntry = {
        capperId: capper.id,
        userId: capper.user.id,
        connectionId: best?.id ?? null,
        handle: capper.user.username,
        displayName: capper.user.displayName,
        email: capper.user.email,
        // Fall back to the provider recorded on the carried offers, so a
        // transferred storefront still reports who it is hosted with.
        provider:
          best?.provider ?? capper.packages[0]?.affiliateProvider ?? null,
        status: best?.status ?? null,
        submittedAt: best?.submittedAt ?? null,
        carriedLivePackages,
      };
      const bucket = storefrontCoverageBucket(
        capper.storeConnections.map((c) => c.status),
        { carriedLivePackages },
      );
      coverage[bucket].push(entry);
    }

    return coverage;
  } catch (error) {
    console.error("[getStorefrontCoverage] database unavailable:", error);
    return EMPTY_COVERAGE;
  }
}

/**
 * Every package a capper currently has, regardless of which store connection
 * (if any) it hangs off.
 *
 * The review panel otherwise only lists packages attached to the connection
 * being reviewed, which hides two common cases: offers under the capper's
 * *other* provider, and offers with no connection at all — which is every
 * package carried over from the previous platform. Approving a new storefront
 * without seeing those means approving blind.
 */
export async function getCapperPackagesForReview(capperId: string) {
  try {
    const packages = await prisma.package.findMany({
      where: { capperId },
      orderBy: [
        { isActive: "desc" },
        { sortOrder: "asc" },
        { createdAt: "asc" },
      ],
      select: {
        id: true,
        title: true,
        priceCents: true,
        billingPeriod: true,
        billingIntervalCount: true,
        isActive: true,
        sortOrder: true,
        checkoutUrl: true,
        affiliateProvider: true,
        storeConnectionId: true,
        updatedAt: true,
        storeConnection: { select: { provider: true, status: true } },
        trackingUrls: {
          select: { slug: true, _count: { select: { clicks: true } } },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { playLinks: true, parlayLinks: true } },
      },
    });

    return packages.map((pkg) => ({
      id: pkg.id,
      title: pkg.title,
      priceLabel: formatPriceCents(
        pkg.priceCents,
        pkg.billingPeriod,
        pkg.billingIntervalCount,
      ),
      isActive: pkg.isActive,
      sortOrder: pkg.sortOrder,
      hasCheckoutUrl: Boolean(pkg.checkoutUrl),
      checkoutUrl: pkg.checkoutUrl,
      // Falls back to the connection's provider: a carried-over offer records
      // the provider on the package itself and has no connection.
      provider: pkg.affiliateProvider ?? pkg.storeConnection?.provider ?? null,
      connectionStatus: pkg.storeConnection?.status ?? null,
      storeConnectionId: pkg.storeConnectionId,
      /** No connection at all — imported, or created before onboarding existed. */
      unattached: pkg.storeConnectionId === null,
      trackingSlug: pkg.trackingUrls[0]?.slug ?? null,
      clicks: pkg.trackingUrls.reduce((n, u) => n + u._count.clicks, 0),
      attributedPicks: pkg._count.playLinks + pkg._count.parlayLinks,
      updatedAt: pkg.updatedAt,
      /**
       * Truly public on the profile: active + checkout + tracking, and either
       * unattached (legacy) or the storefront connection is LIVE.
       */
      publishable: isPackagePubliclyPublishable({
        isActive: pkg.isActive,
        checkoutUrl: pkg.checkoutUrl,
        hasTrackingUrl: pkg.trackingUrls.length > 0,
        storeConnectionId: pkg.storeConnectionId,
        storeConnectionStatus: pkg.storeConnection?.status ?? null,
      }),
    }));
  } catch (error) {
    console.error("[getCapperPackagesForReview] database unavailable:", error);
    return [];
  }
}
