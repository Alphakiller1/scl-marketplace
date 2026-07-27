import type {
  PackageImportStatus,
  StoreConnectionStatus,
  StoreProvider,
  StorefrontReviewAction,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

const GHOST_DOMAIN = "@ghost.scl.demo";

type ShowcaseConnection = {
  handle: string;
  provider: StoreProvider;
  status: StoreConnectionStatus;
  importStatus: PackageImportStatus;
  note: string;
  review?: {
    action: StorefrontReviewAction;
    previousStatus: StoreConnectionStatus;
    reason: string;
  };
  package?: {
    title: string;
    description: string;
    promoOffer: string;
    priceCents: number;
    sortOrder: number;
    clicks: number;
  };
};

const SHOWCASE_CONNECTIONS: ShowcaseConnection[] = [
  {
    handle: "linehawk",
    provider: "WINIBLE",
    status: "PENDING_SCL_ACCEPTANCE",
    importStatus: "NOT_STARTED",
    note: "Ghost showcase — affiliate request submitted; SCL is waiting for the Winible invitation. Safe to edit.",
  },
  {
    handle: "diamondedge",
    provider: "WHOP",
    status: "PENDING_SCL_LINK_IMPORT",
    importStatus: "NOT_STARTED",
    note: "Ghost showcase — affiliate relationship is ready for SCL review and package-link import. Safe to edit.",
  },
  {
    handle: "gridironmetrics",
    provider: "WINIBLE",
    status: "LINKS_RECEIVED",
    importStatus: "LINKS_RECEIVED",
    note: "Ghost showcase — approved affiliate links received; package details still need to be entered. Safe to edit.",
    review: {
      action: "APPROVED",
      previousStatus: "PENDING_SCL_ACCEPTANCE",
      reason: "Affiliate relationship approved for the ghost workflow.",
    },
  },
  {
    handle: "icecoldpucks",
    provider: "WHOP",
    status: "PACKAGES_IMPORTED",
    importStatus: "IMPORTED",
    note: "Ghost showcase — package imported and awaiting the final storefront review. Safe to edit.",
    review: {
      action: "PACKAGE_SYNC",
      previousStatus: "LINKS_RECEIVED",
      reason: "Representative Whop package imported for admin training.",
    },
    package: {
      title: "Ice Cold Pucks — Weekly Card",
      description:
        "Demonstration package for editing price, copy, checkout link, visibility, and display order.",
      promoOffer: "Ghost example: 3-day trial",
      priceCents: 1900,
      sortOrder: 10,
      clicks: 7,
    },
  },
  {
    handle: "hardwoodmodel",
    provider: "WINIBLE",
    status: "NEEDS_ACTION",
    importStatus: "IMPORTED",
    note: "Ghost showcase — checkout link and trial language need confirmation before approval. Safe to edit.",
    review: {
      action: "CHANGES_REQUESTED",
      previousStatus: "PACKAGES_IMPORTED",
      reason: "Confirm the checkout destination and trial terms.",
    },
    package: {
      title: "Hardwood Model — Monthly Access",
      description:
        "Demonstration package intentionally placed in Needs Attention for the admin review queue.",
      promoOffer: "Ghost example: trial terms need review",
      priceCents: 4900,
      sortOrder: 20,
      clicks: 12,
    },
  },
  {
    handle: "closingline",
    provider: "WHOP",
    status: "DISABLED",
    importStatus: "IMPORTED",
    note: "Ghost showcase — storefront suspended while package claims are reviewed. Safe to restore or edit.",
    review: {
      action: "SUSPENDED",
      previousStatus: "LIVE",
      reason: "Representative suspension for admin workflow training.",
    },
    package: {
      title: "Closing Line — Season Pass",
      description:
        "Demonstration suspended package for manual correction, removal, and restoration workflows.",
      promoOffer: "Ghost example only",
      priceCents: 12900,
      sortOrder: 30,
      clicks: 4,
    },
  },
];

function assertShowcaseTarget(allowProduction: boolean) {
  if (process.env.ADMIN_SHOWCASE_SEED !== "1") {
    throw new Error(
      "Refusing to seed: set ADMIN_SHOWCASE_SEED=1 to confirm the admin showcase operation.",
    );
  }

  const databaseUrl = process.env.DATABASE_URL ?? "";
  const looksProduction =
    /pooler\.supabase\.com/.test(databaseUrl) &&
    /(?:[?&])schema=scl(?:&|$)/.test(databaseUrl);

  if (looksProduction && !allowProduction) {
    throw new Error(
      "Refusing to seed the production SCL schema without an explicit production confirmation.",
    );
  }
}

export async function seedAdminShowcase(options?: {
  allowProduction?: boolean;
}) {
  assertShowcaseTarget(options?.allowProduction === true);

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", accountStatus: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!admin) {
    throw new Error("No active admin exists; cannot create review history.");
  }

  const handles = SHOWCASE_CONNECTIONS.map((item) => item.handle);
  const profiles = await prisma.capperProfile.findMany({
    where: {
      user: {
        username: { in: handles },
        email: { endsWith: GHOST_DOMAIN },
        isTest: true,
      },
    },
    select: {
      id: true,
      user: { select: { username: true } },
    },
  });
  const profileByHandle = new Map(
    profiles.map((profile) => [profile.user.username, profile]),
  );
  const missing = handles.filter((handle) => !profileByHandle.has(handle));
  if (missing.length) {
    throw new Error(
      `Missing required ghost cappers: ${missing.join(", ")}. Run the ghost seed first.`,
    );
  }

  return prisma.$transaction(async (tx) => {
    const profileIds = profiles.map((profile) => profile.id);

    // Fail closed: old ghost packages for these examples cannot remain on a LIVE
    // connection while the admin training states are installed.
    await tx.storeConnection.updateMany({
      where: { capperId: { in: profileIds } },
      data: {
        status: "DISABLED",
        adminNotes:
          "Ghost showcase — superseded example connection. Safe to inspect; not public.",
        reviewedAt: new Date(),
        reviewedById: admin.id,
      },
    });
    await tx.capperProfile.updateMany({
      where: { id: { in: profileIds } },
      data: { storefrontEnabled: false },
    });

    let packageCount = 0;
    let clickCount = 0;

    for (const item of SHOWCASE_CONNECTIONS) {
      const profile = profileByHandle.get(item.handle)!;
      const connectionId = `admin-showcase-${item.handle}-${item.provider.toLowerCase()}`;
      const connection = await tx.storeConnection.upsert({
        where: {
          capperId_provider: {
            capperId: profile.id,
            provider: item.provider,
          },
        },
        create: {
          id: connectionId,
          capperId: profile.id,
          provider: item.provider,
          status: item.status,
          packageImportStatus: item.importStatus,
          submittedAt: new Date("2026-07-20T14:00:00.000Z"),
          acknowledgmentAt: new Date("2026-07-20T14:05:00.000Z"),
          adminNotes: item.note,
          reviewedAt: item.review ? new Date("2026-07-21T15:30:00.000Z") : null,
          reviewedById: item.review ? admin.id : null,
        },
        update: {
          status: item.status,
          packageImportStatus: item.importStatus,
          submittedAt: new Date("2026-07-20T14:00:00.000Z"),
          acknowledgmentAt: new Date("2026-07-20T14:05:00.000Z"),
          adminNotes: item.note,
          reviewedAt: item.review ? new Date("2026-07-21T15:30:00.000Z") : null,
          reviewedById: item.review ? admin.id : null,
        },
      });

      const eventId = `admin-showcase-review-${item.handle}-${item.provider.toLowerCase()}`;
      if (item.review) {
        await tx.storefrontReviewEvent.upsert({
          where: { id: eventId },
          create: {
            id: eventId,
            storeConnectionId: connection.id,
            action: item.review.action,
            previousStatus: item.review.previousStatus,
            newStatus: item.status,
            reviewedById: admin.id,
            reason: item.review.reason,
            adminNotes: item.note,
            createdAt: new Date("2026-07-21T15:30:00.000Z"),
          },
          update: {
            storeConnectionId: connection.id,
            action: item.review.action,
            previousStatus: item.review.previousStatus,
            newStatus: item.status,
            reviewedById: admin.id,
            reason: item.review.reason,
            adminNotes: item.note,
          },
        });
      } else {
        await tx.storefrontReviewEvent.deleteMany({
          where: { id: eventId },
        });
      }

      if (!item.package) continue;

      const packageId = `admin-showcase-package-${item.handle}`;
      const showcasePackage = await tx.package.upsert({
        where: { id: packageId },
        create: {
          id: packageId,
          capperId: profile.id,
          storeConnectionId: connection.id,
          title: item.package.title,
          description: item.package.description,
          promoOffer: item.package.promoOffer,
          priceCents: item.package.priceCents,
          billingPeriod: "MONTH",
          checkoutUrl: `https://example.com/scl-ghost/${item.handle}`,
          affiliateProvider: item.provider,
          providerType: "PREMIUM",
          sortOrder: item.package.sortOrder,
          isActive: false,
        },
        update: {
          capperId: profile.id,
          storeConnectionId: connection.id,
          title: item.package.title,
          description: item.package.description,
          promoOffer: item.package.promoOffer,
          priceCents: item.package.priceCents,
          billingPeriod: "MONTH",
          checkoutUrl: `https://example.com/scl-ghost/${item.handle}`,
          affiliateProvider: item.provider,
          providerType: "PREMIUM",
          sortOrder: item.package.sortOrder,
          isActive: false,
        },
      });
      packageCount += 1;

      const trackingId = `admin-showcase-tracking-${item.handle}`;
      const tracking = await tx.trackingUrl.upsert({
        where: { slug: `ghost-showcase-${item.handle}` },
        create: {
          id: trackingId,
          packageId: showcasePackage.id,
          slug: `ghost-showcase-${item.handle}`,
          targetUrl: `https://example.com/scl-ghost/${item.handle}`,
        },
        update: {
          packageId: showcasePackage.id,
          targetUrl: `https://example.com/scl-ghost/${item.handle}`,
        },
      });

      for (let index = 0; index < item.package.clicks; index += 1) {
        await tx.clickEvent.upsert({
          where: { id: `admin-showcase-click-${item.handle}-${index + 1}` },
          create: {
            id: `admin-showcase-click-${item.handle}-${index + 1}`,
            trackingUrlId: tracking.id,
            referrer: "https://scl-marketplace.vercel.app/admin",
            userAgent: "SCL ghost showcase",
            createdAt: new Date(
              Date.UTC(2026, 6, 22, 12 + (index % 8), index, 0),
            ),
          },
          update: { trackingUrlId: tracking.id },
        });
        clickCount += 1;
      }
    }

    return {
      connections: SHOWCASE_CONNECTIONS.length,
      packages: packageCount,
      clicks: clickCount,
    };
  });
}
