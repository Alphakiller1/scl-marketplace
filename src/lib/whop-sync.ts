import { prisma } from "@/lib/prisma";
import {
  buildWhopProductCheckoutUrl,
  listWhopProducts,
  type WhopProductListItem,
} from "@/lib/whop-api";
import { whopAffiliateUsername } from "@/lib/whop-config";
import { makeTrackingSlug } from "@/lib/store-connection";
import { resolveStorefrontPackageReadiness } from "@/lib/storefront-review";

export type WhopSyncResult =
  | {
      ok: true;
      imported: number;
      updated: number;
      skipped: number;
    }
  | { ok: false; error: string };

function productDescription(product: WhopProductListItem): string | null {
  const headline = product.headline?.trim();
  return headline || null;
}

function isSyncableProduct(product: WhopProductListItem): boolean {
  return (
    product.visibility === "visible" || product.visibility === "quick_link"
  );
}

export async function syncWhopStorefront(input: {
  storeConnectionId: string;
  actorId: string;
}): Promise<WhopSyncResult> {
  const affiliateUsername = whopAffiliateUsername();
  if (!affiliateUsername) {
    return {
      ok: false,
      error:
        "WHOP_AFFILIATE_USERNAME is not configured — cannot build attributed checkout links.",
    };
  }

  const connection = await prisma.storeConnection.findUnique({
    where: { id: input.storeConnectionId },
    select: {
      id: true,
      provider: true,
      status: true,
      packageImportStatus: true,
      adminNotes: true,
      whopCompanyId: true,
      whopCompanyRoute: true,
      whopAccessToken: true,
      capperId: true,
      capper: {
        select: { user: { select: { username: true } } },
      },
    },
  });

  if (!connection) return { ok: false, error: "Store connection not found." };
  if (connection.provider !== "WHOP") {
    return { ok: false, error: "This sync only applies to Whop storefronts." };
  }
  if (!connection.whopAccessToken || !connection.whopCompanyId) {
    return {
      ok: false,
      error:
        "Capper has not connected Whop yet. They must install the SCL app from Dashboard → Storefront.",
    };
  }
  if (!connection.whopCompanyRoute) {
    return {
      ok: false,
      error:
        "Whop company route is missing. Ask the capper to reconnect the SCL app.",
    };
  }

  let products: WhopProductListItem[];
  try {
    products = await listWhopProducts({
      accessToken: connection.whopAccessToken,
      companyId: connection.whopCompanyId,
    });
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String((error as { message: string }).message)
        : "Could not fetch products from Whop.";
    return { ok: false, error: message };
  }

  const syncable = products.filter(isSyncableProduct);
  if (!syncable.length) {
    return {
      ok: false,
      error: "No visible Whop products found for this capper's business.",
    };
  }

  let imported = 0;
  let updated = 0;
  const skipped = products.length - syncable.length;

  await prisma.$transaction(async (tx) => {
    for (const [index, product] of syncable.entries()) {
      const checkoutUrl = buildWhopProductCheckoutUrl({
        companyRoute: connection.whopCompanyRoute!,
        productRoute: product.route,
        affiliateUsername,
      });

      const existing = await tx.package.findFirst({
        where: {
          storeConnectionId: connection.id,
          externalProductId: product.id,
        },
        select: { id: true, trackingUrls: { select: { id: true }, take: 1 } },
      });

      if (existing) {
        await tx.package.update({
          where: { id: existing.id },
          data: {
            title: product.title,
            description: productDescription(product),
            checkoutUrl,
            affiliateProvider: "WHOP",
            sortOrder: index,
          },
        });
        const tracking = existing.trackingUrls[0];
        if (tracking) {
          await tx.trackingUrl.update({
            where: { id: tracking.id },
            data: { targetUrl: checkoutUrl },
          });
        }
        updated += 1;
        continue;
      }

      const pkg = await tx.package.create({
        data: {
          capperId: connection.capperId,
          storeConnectionId: connection.id,
          externalProductId: product.id,
          title: product.title,
          description: productDescription(product),
          checkoutUrl,
          affiliateProvider: "WHOP",
          priceCents: 0,
          billingPeriod: "MONTH",
          providerType: "PREMIUM",
          sortOrder: index,
          isActive: false,
        },
      });

      await tx.trackingUrl.create({
        data: {
          packageId: pkg.id,
          slug: makeTrackingSlug(product.route),
          targetUrl: checkoutUrl,
        },
      });

      await tx.packageAuditEvent.create({
        data: {
          packageId: pkg.id,
          capperId: connection.capperId,
          actorId: input.actorId,
          action: "CREATED",
          summary: `Imported from Whop: "${product.title}"`,
        },
      });

      imported += 1;
    }

    const [packageCount, liveCount] = await Promise.all([
      tx.package.count({ where: { storeConnectionId: connection.id } }),
      tx.package.count({
        where: { storeConnectionId: connection.id, isActive: true },
      }),
    ]);

    const readiness = resolveStorefrontPackageReadiness({
      currentStatus: connection.status,
      packageCount,
      activePackageCount: liveCount,
    });

    const now = new Date();
    const nextImportStatus =
      packageCount > 0 ? ("IMPORTED" as const) : connection.packageImportStatus;

    await tx.storeConnection.update({
      where: { id: connection.id },
      data: {
        packageImportStatus: nextImportStatus,
        status: readiness.status,
        packageCount,
        lastImportedAt: now,
      },
    });

    await tx.storefrontReviewEvent.create({
      data: {
        storeConnectionId: connection.id,
        action: "PACKAGE_SYNC",
        previousStatus: connection.status,
        newStatus: readiness.status,
        reviewedById: input.actorId,
        reason: `Whop sync: ${imported} imported, ${updated} updated, ${skipped} skipped.`,
        adminNotes: connection.adminNotes,
      },
    });
  });

  return { ok: true, imported, updated, skipped };
}

/** Resolve company from OAuth token and persist credentials on the connection. */
export async function persistWhopOAuthCredentials(input: {
  storeConnectionId: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  companies: Array<{ id: string; route: string }>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const company = input.companies[0];
  if (!company) {
    return {
      ok: false,
      error: "Whop did not return a company for this app install.",
    };
  }

  const expiresAt = new Date(Date.now() + input.expiresIn * 1000);
  await prisma.storeConnection.update({
    where: { id: input.storeConnectionId },
    data: {
      whopCompanyId: company.id,
      whopCompanyRoute: company.route,
      whopAccessToken: input.accessToken,
      whopRefreshToken: input.refreshToken ?? null,
      whopTokenExpiresAt: expiresAt,
      whopConnectedAt: new Date(),
      requiresAttention: true,
    },
  });

  return { ok: true };
}

export async function findWhopConnectionForCompany(
  companyId: string,
): Promise<{ id: string } | null> {
  return prisma.storeConnection.findFirst({
    where: { provider: "WHOP", whopCompanyId: companyId },
    select: { id: true },
  });
}

export type WhopWebhookEnvelope = {
  action?: string;
  type?: string;
  data?: Record<string, unknown>;
};

export function whopWebhookEventName(
  event: WhopWebhookEnvelope,
): string | null {
  return event.action ?? event.type ?? null;
}

export function whopWebhookCompanyId(
  event: WhopWebhookEnvelope,
): string | null {
  const data = event.data;
  if (!data) return null;
  const company = data.company;
  if (company && typeof company === "object" && "id" in company) {
    return String((company as { id: string }).id);
  }
  if (typeof data.company_id === "string") return data.company_id;
  return null;
}
