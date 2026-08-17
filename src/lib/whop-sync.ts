import { prisma } from "@/lib/prisma";
import {
  buildWhopProductCheckoutUrl,
  listWhopProducts,
  updateWhopProduct,
  type WhopProductListItem,
} from "@/lib/whop-api";
import {
  whopAffiliateUsername,
  whopAppApiKey,
  whopAppId,
} from "@/lib/whop-config";
import { refreshWhopAccessToken } from "@/lib/whop-oauth";
import {
  isWhopProductSyncable,
  whopProductSyncAction,
} from "@/lib/whop-product-sync";
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
      whopRefreshToken: true,
      whopTokenExpiresAt: true,
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

  let accessToken = connection.whopAccessToken;
  const tokenExpired =
    connection.whopTokenExpiresAt != null &&
    connection.whopTokenExpiresAt.getTime() <= Date.now() + 60_000;
  if (tokenExpired) {
    if (!connection.whopRefreshToken) {
      return {
        ok: false,
        error:
          "Whop access expired. Ask the capper to reinstall the SCL app from Dashboard → Storefront.",
      };
    }
    const clientId = whopAppId();
    const clientSecret = whopAppApiKey();
    if (!clientId || !clientSecret) {
      return {
        ok: false,
        error:
          "Whop OAuth is not configured — cannot refresh the access token.",
      };
    }
    try {
      const refreshed = await refreshWhopAccessToken({
        refreshToken: connection.whopRefreshToken,
        clientId,
        clientSecret,
      });
      accessToken = refreshed.access_token;
      await prisma.storeConnection.update({
        where: { id: connection.id },
        data: {
          whopAccessToken: refreshed.access_token,
          whopRefreshToken:
            refreshed.refresh_token ?? connection.whopRefreshToken,
          whopTokenExpiresAt: new Date(
            Date.now() + refreshed.expires_in * 1000,
          ),
        },
      });
    } catch (error) {
      console.error("[whop-sync] token refresh failed:", error);
      return {
        ok: false,
        error:
          "Whop access expired and refresh failed. Ask the capper to reinstall the SCL app.",
      };
    }
  }

  let products: WhopProductListItem[];
  try {
    products = await listWhopProducts({
      accessToken,
      companyId: connection.whopCompanyId,
    });
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String((error as { message: string }).message)
        : "Could not fetch products from Whop.";
    return { ok: false, error: message };
  }

  const syncable = products.filter(isWhopProductSyncable);
  if (!syncable.length) {
    const hiddenProductIds = products.map((product) => product.id);
    const mappedHiddenCount = hiddenProductIds.length
      ? await prisma.package.count({
          where: {
            storeConnectionId: connection.id,
            externalProductId: { in: hiddenProductIds },
          },
        })
      : 0;
    if (!mappedHiddenCount) {
      return {
        ok: false,
        error: "No visible Whop products found for this capper's business.",
      };
    }
  }

  let imported = 0;
  let updated = 0;
  let skipped = 0;

  await prisma.$transaction(async (tx) => {
    for (const [index, product] of products.entries()) {
      const existing = await tx.package.findFirst({
        where: {
          storeConnectionId: connection.id,
          externalProductId: product.id,
        },
        select: {
          id: true,
          isActive: true,
          title: true,
          trackingUrls: { select: { id: true }, take: 1 },
        },
      });

      const syncAction = whopProductSyncAction(product, Boolean(existing));
      if (syncAction !== "upsert") {
        if (syncAction === "skip" || !existing) {
          skipped += 1;
          continue;
        }

        await tx.package.update({
          where: { id: existing.id },
          data: {
            title: product.title,
            description: productDescription(product),
            isActive: false,
          },
        });
        if (existing.isActive) {
          await tx.packageAuditEvent.create({
            data: {
              packageId: existing.id,
              capperId: connection.capperId,
              actorId: input.actorId,
              action: "DEACTIVATED",
              summary: `Hidden on Whop: "${product.title || existing.title}"`,
            },
          });
        }
        updated += 1;
        continue;
      }

      const checkoutUrl = buildWhopProductCheckoutUrl({
        companyRoute: connection.whopCompanyRoute!,
        productRoute: product.route,
        affiliateUsername,
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

/**
 * Push an SCL storefront edit back to Whop — the outbound half of the sync.
 *
 * Only ever called from an explicit SCL edit, never from `syncWhopStorefront`.
 * That asymmetry is what prevents an oscillation: the cycle needs a
 * sync-triggers-push edge, and that edge simply does not exist. Whop's own
 * `product.updated` webhook then writes the same values back into SCL, which is
 * a no-op rather than a new push.
 *
 * Title, headline and visibility only. Price lives on a Whop Plan and decides
 * what real customers are charged — SCL owns presentation, Whop owns money.
 *
 * Returns a typed result and never throws: the SCL edit has already been saved
 * by the time this runs, and a Whop outage must not undo it or surface as a
 * failed save.
 */
export async function pushPackageToWhop(
  packageId: string,
): Promise<{ ok: true; pushed: boolean } | { ok: false; error: string }> {
  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
    select: {
      id: true,
      title: true,
      description: true,
      isActive: true,
      externalProductId: true,
      affiliateProvider: true,
      storeConnection: {
        select: {
          id: true,
          provider: true,
          whopAccessToken: true,
          whopRefreshToken: true,
          whopTokenExpiresAt: true,
          whopCompanyId: true,
        },
      },
    },
  });

  // Not a Whop-backed offer: nothing upstream to update. Not an error — most
  // packages are Winible or unattached carry-overs.
  const connection = pkg?.storeConnection;
  if (
    !pkg?.externalProductId ||
    !connection ||
    connection.provider !== "WHOP"
  ) {
    return { ok: true, pushed: false };
  }
  if (!connection.whopAccessToken || !connection.whopCompanyId) {
    return { ok: true, pushed: false };
  }

  // Reuse the stored token. Refresh stays syncWhopStorefront's job — a push is
  // a side effect of an edit that has already been saved, so an expired token
  // should report a clear failure, not silently mutate credentials from a code
  // path nobody is watching.
  const result = await updateWhopProduct({
    accessToken: connection.whopAccessToken,
    productId: pkg.externalProductId,
    update: {
      title: pkg.title,
      headline: pkg.description,
      visibility: pkg.isActive ? "visible" : "hidden",
      metadata: { scl_pushed_at: new Date().toISOString() },
    },
  });
  if (!result.ok) return result;
  return { ok: true, pushed: true };
}
