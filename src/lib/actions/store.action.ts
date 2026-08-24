"use server";

import { afterResponse } from "@/lib/after-response";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { sendAffiliateSignupNotificationEmail } from "@/lib/email";
import { requireAdmin, requireCapperAccess } from "@/lib/session";
import {
  adminPackageActiveSchema,
  adminPackageDeleteSchema,
  adminPackageReorderSchema,
  adminPackageSchema,
  adminUpdateStoreConnectionSchema,
  capperWhopPackageUpdateSchema,
  markInstructionsViewedSchema,
  submitStoreConnectionSchema,
  type AdminPackageActiveInput,
  type AdminPackageDeleteInput,
  type AdminPackageReorderInput,
  type AdminPackageInput,
  type AdminUpdateStoreConnectionInput,
  type CapperWhopPackageUpdateInput,
  type SubmitStoreConnectionInput,
} from "@/lib/schemas/store.schema";
import {
  makeTrackingSlug,
  pendingStatusForProvider,
} from "@/lib/store-connection";
import {
  canCapperOpenStorefrontSetup,
  canCapperSubmitStorefront,
  resolveStorefrontPackageReadiness,
  storefrontTransition,
} from "@/lib/storefront-review";
import { pushPackageToWhop, syncWhopStorefront } from "@/lib/whop-sync";
import { whopAffiliateUsername, whopOAuthConfigured } from "@/lib/whop-config";
import { revalidateCommerceSurfaces } from "@/lib/revalidate-commerce";

type ActionResult = { ok: true } | { ok: false; error: string };

async function revalidateCommercePaths(
  username?: string | null,
  capperUserId?: string | null,
) {
  revalidateCommerceSurfaces({ username, capperUserId });
}

/**
 * Keep package readiness in sync without bypassing explicit live approval or
 * clobbering admin-locked statuses (Suspended / Needs Attention).
 */
async function syncConnectionFromLivePackages(
  tx: Prisma.TransactionClient,
  storeConnectionId: string,
  actorId: string,
) {
  const [packageCount, liveCount, conn] = await Promise.all([
    tx.package.count({
      where: { storeConnectionId },
    }),
    tx.package.count({
      where: { storeConnectionId, isActive: true },
    }),
    tx.storeConnection.findUnique({
      where: { id: storeConnectionId },
      select: {
        status: true,
        packageImportStatus: true,
        adminNotes: true,
      },
    }),
  ]);
  if (!conn) return;

  const readiness = resolveStorefrontPackageReadiness({
    currentStatus: conn.status,
    packageCount,
    activePackageCount: liveCount,
  });

  const now = new Date();
  await tx.storeConnection.update({
    where: { id: storeConnectionId },
    data: {
      packageImportStatus: readiness.packageImportStatus,
      status: readiness.status,
      packageCount,
      lastImportedAt: now,
    },
  });

  if (
    readiness.status !== conn.status ||
    readiness.packageImportStatus !== conn.packageImportStatus
  ) {
    await tx.storefrontReviewEvent.create({
      data: {
        storeConnectionId,
        action: "PACKAGE_SYNC",
        previousStatus: conn.status,
        newStatus: readiness.status,
        reviewedById: actorId,
        reason: "Package configuration changed storefront readiness.",
        adminNotes: conn.adminNotes,
      },
    });
  }
}

export async function markInstructionsViewedAction(input: {
  provider: "WINIBLE" | "WHOP";
}): Promise<ActionResult> {
  const user = await requireCapperAccess();
  const parsed = markInstructionsViewedSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid provider." };

  const profile = await prisma.capperProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!profile) return { ok: false, error: "Capper profile not found." };

  const connection = await prisma.storeConnection.upsert({
    where: {
      capperId_provider: {
        capperId: profile.id,
        provider: parsed.data.provider,
      },
    },
    create: {
      capperId: profile.id,
      provider: parsed.data.provider,
      status: "INSTRUCTIONS_VIEWED",
    },
    update: {},
    select: { id: true, status: true },
  });
  if (connection.status === "DISABLED") {
    return {
      ok: false,
      error:
        "This storefront is suspended. Contact SCL before restarting setup.",
    };
  }
  if (!canCapperOpenStorefrontSetup(connection.status)) {
    return {
      ok: false,
      error:
        "This storefront workflow has already advanced. Refresh its status.",
    };
  }
  const updated = await prisma.storeConnection.updateMany({
    where: {
      id: connection.id,
      status: { in: ["NOT_STARTED", "INSTRUCTIONS_VIEWED"] },
    },
    data: { status: "INSTRUCTIONS_VIEWED" },
  });
  if (updated.count !== 1) {
    return {
      ok: false,
      error:
        "The storefront changed while setup was opening. Refresh and try again.",
    };
  }

  revalidateCommerceSurfaces();
  return { ok: true };
}

export async function submitStoreConnectionAction(
  input: SubmitStoreConnectionInput,
): Promise<ActionResult> {
  const user = await requireCapperAccess();
  const parsed = submitStoreConnectionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message || "Invalid submission.",
    };
  }

  const profile = await prisma.capperProfile.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      user: { select: { username: true, email: true } },
    },
  });
  if (!profile) return { ok: false, error: "Capper profile not found." };

  const status = pendingStatusForProvider(parsed.data.provider);
  const now = new Date();

  const connection = await prisma.storeConnection.findUnique({
    where: {
      capperId_provider: {
        capperId: profile.id,
        provider: parsed.data.provider,
      },
    },
    select: { id: true, status: true },
  });
  if (!connection) {
    return {
      ok: false,
      error: "Review the provider setup instructions before submitting.",
    };
  }
  if (connection.status === "DISABLED") {
    return {
      ok: false,
      error: "This storefront is suspended. Contact SCL before resubmitting.",
    };
  }
  if (!canCapperSubmitStorefront(connection.status)) {
    return {
      ok: false,
      error:
        "This storefront workflow has already advanced. Refresh its status.",
    };
  }

  const updated = await prisma.storeConnection.updateMany({
    where: {
      id: connection.id,
      status: "INSTRUCTIONS_VIEWED",
    },
    data: {
      status,
      packageImportStatus: "NOT_STARTED",
      submittedAt: now,
      acknowledgmentAt: now,
      // A capper confirming their affiliate steps must surface to admins
      // immediately — this lights the admin nav badge + Needs-attention queue.
      requiresAttention: true,
    },
  });
  if (updated.count !== 1) {
    return {
      ok: false,
      error: "The storefront changed while submitting. Refresh and try again.",
    };
  }

  // Scheduled rather than fired-and-forgotten: an un-awaited send races the
  // response and is dropped when the isolate is torn down, so this notification
  // often never left the building.
  afterResponse(async () => {
    try {
      await sendAffiliateSignupNotificationEmail({
        capperUsername: profile.user.username ?? profile.user.email,
        capperEmail: profile.user.email,
        provider: parsed.data.provider,
        connectionId: connection.id,
        submittedAt: now,
      });
    } catch (error) {
      console.error("[store] affiliate signup notification failed:", error);
    }
  });

  await revalidateCommercePaths(profile.user.username, user.id);
  return { ok: true };
}

export async function adminUpdateStoreConnectionAction(
  input: AdminUpdateStoreConnectionInput,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = adminUpdateStoreConnectionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message || "Invalid request.",
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const conn = await tx.storeConnection.findUnique({
      where: { id: parsed.data.connectionId },
      select: {
        id: true,
        status: true,
        updatedAt: true,
        packageImportStatus: true,
        adminNotes: true,
        capper: {
          select: {
            user: { select: { id: true, username: true } },
          },
        },
      },
    });
    if (!conn) {
      return { ok: false as const, error: "Store request not found." };
    }
    if (
      conn.status !== parsed.data.expectedStatus ||
      conn.updatedAt.getTime() !==
        new Date(parsed.data.expectedUpdatedAt).getTime()
    ) {
      return {
        ok: false as const,
        error:
          "This storefront changed after you opened it. Refresh and review the latest status.",
      };
    }

    const packageCount =
      parsed.data.action === "APPROVE"
        ? await tx.package.count({
            where: { storeConnectionId: conn.id },
          })
        : 0;
    const transition = storefrontTransition(conn.status, parsed.data.action, {
      hasPackages: packageCount > 0,
    });
    if (!transition) {
      return {
        ok: false as const,
        error: "That action is not allowed from the current storefront status.",
      };
    }

    if (parsed.data.action === "MARK_LIVE") {
      const livePackageCount = await tx.package.count({
        where: {
          storeConnectionId: conn.id,
          isActive: true,
          checkoutUrl: { not: null },
        },
      });
      if (livePackageCount === 0) {
        return {
          ok: false as const,
          error:
            "Add and activate at least one package with a checkout link before marking this storefront live.",
        };
      }
    }

    const adminNotes =
      parsed.data.adminNotes === undefined
        ? conn.adminNotes
        : parsed.data.adminNotes.trim() || null;
    const packageImportStatus =
      parsed.data.action === "APPROVE"
        ? packageCount > 0
          ? ("IMPORTED" as const)
          : ("LINKS_RECEIVED" as const)
        : parsed.data.action === "MARK_LIVE"
          ? ("LIVE" as const)
          : conn.packageImportStatus;
    const now = new Date();

    // Workflow field updates
    const affiliateAcceptedAt =
      parsed.data.action === "APPROVE" ? now : undefined;
    const lastImportedAt = parsed.data.action === "MARK_LIVE" ? now : undefined;
    // Always write this explicitly. Capper submissions set requiresAttention so
    // admins get alerted; if we only ever set `true`, the flag would stick
    // forever and the nav badge / Needs-attention filter would never clear.
    // An admin acting on the connection IS the acknowledgement — the only state
    // that stays flagged is NEEDS_ACTION. The badge still counts pending-SCL
    // statuses separately (countStorefrontQueue), so nothing gets lost.
    const requiresAttention = transition.targetStatus === "NEEDS_ACTION";
    const affiliatePercent =
      parsed.data.affiliatePercent === undefined
        ? undefined
        : parsed.data.affiliatePercent;

    const updated = await tx.storeConnection.updateMany({
      where: {
        id: conn.id,
        status: conn.status,
        updatedAt: conn.updatedAt,
      },
      data: {
        status: transition.targetStatus,
        packageImportStatus,
        adminNotes,
        reviewedAt: now,
        reviewedById: admin.id,
        ...(affiliateAcceptedAt && { affiliateAcceptedAt }),
        ...(lastImportedAt && { lastImportedAt }),
        ...(affiliatePercent !== undefined && { affiliatePercent }),
        requiresAttention,
        ...(packageCount > 0 && { packageCount }),
      },
    });
    if (updated.count !== 1) {
      return {
        ok: false as const,
        error:
          "This storefront changed while you were saving. Refresh and try again.",
      };
    }

    await tx.storefrontReviewEvent.create({
      data: {
        storeConnectionId: conn.id,
        action: transition.auditAction,
        previousStatus: conn.status,
        newStatus: transition.targetStatus,
        reviewedById: admin.id,
        reason: parsed.data.reason?.trim() || null,
        adminNotes,
      },
    });

    return {
      ok: true as const,
      username: conn.capper.user.username,
      capperUserId: conn.capper.user.id,
    };
  });
  if (!result.ok) return result;

  await revalidateCommercePaths(result.username, result.capperUserId);
  return { ok: true };
}

/**
 * Mirror an SCL storefront edit up to Whop, after the response.
 *
 * Called only from explicit SCL edits — never from `syncWhopStorefront`. That
 * asymmetry is the loop guard: an oscillation needs a sync-triggers-push edge,
 * and there isn't one. A no-op for Winible and unattached packages.
 *
 * Deliberately fire-and-forget: the edit is already committed, so a Whop
 * outage must not fail the save or make an admin wait on a third party.
 */
function mirrorPackageToWhop(packageId: string): void {
  afterResponse(async () => {
    try {
      const result = await pushPackageToWhop(packageId);
      if (!result.ok) {
        console.warn(
          JSON.stringify({
            level: "warning",
            message: "Immediate Whop package push will be retried",
            packageId,
            error: result.error,
          }),
        );
      }
    } catch (err) {
      console.error("[whop-push] unexpected failure:", err);
    }
  });
}

/**
 * Let a capper edit the presentation of their own attached Whop product.
 *
 * The ownership filter is deliberately relational: knowing a package id is
 * never enough. Price, billing, checkout URLs, and Whop app membership remain
 * provider-owned and cannot be changed through this action.
 */
export async function capperUpdateWhopPackageAction(
  input: CapperWhopPackageUpdateInput,
): Promise<ActionResult> {
  const user = await requireCapperAccess();
  const parsed = capperWhopPackageUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message || "Invalid package update.",
    };
  }
  const d = parsed.data;

  const ownedPackage = await prisma.package.findFirst({
    where: {
      id: d.packageId,
      affiliateProvider: "WHOP",
      externalProductId: { not: null },
      capper: { is: { userId: user.id } },
      storeConnection: {
        is: {
          provider: "WHOP",
          status: { not: "DISABLED" },
          capper: { is: { userId: user.id } },
        },
      },
    },
    select: {
      id: true,
      capperId: true,
      storeConnectionId: true,
      title: true,
      capper: { select: { user: { select: { id: true, username: true } } } },
    },
  });
  if (!ownedPackage?.storeConnectionId) {
    return {
      ok: false,
      error: "This Whop package is not attached to your active storefront.",
    };
  }

  const whopPushQueuedAt = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.package.updateMany({
      where: {
        id: ownedPackage.id,
        capperId: ownedPackage.capperId,
        title: d.expectedTitle,
        description: d.expectedDescription,
        isActive: d.expectedIsActive,
        storeConnection: {
          is: {
            id: ownedPackage.storeConnectionId!,
            provider: "WHOP",
            status: { not: "DISABLED" },
          },
        },
      },
      data: {
        title: d.title,
        description: d.description || null,
        isActive: d.isActive,
        whopPushPendingAt: whopPushQueuedAt,
        whopPushAttempts: 0,
        whopPushLastError: null,
      },
    });
    if (updated.count !== 1) {
      return {
        ok: false as const,
        error:
          "This package changed while you were editing. Refresh and try again.",
      };
    }

    await tx.packageAuditEvent.create({
      data: {
        packageId: ownedPackage.id,
        capperId: ownedPackage.capperId,
        actorId: user.id,
        action: "UPDATED",
        summary: `Capper updated Whop package "${ownedPackage.title}" and queued provider sync.`,
      },
    });
    await syncConnectionFromLivePackages(
      tx,
      ownedPackage.storeConnectionId!,
      user.id,
    );
    return { ok: true as const };
  });
  if (!result.ok) return result;

  // The exact committed revision stays pending until Whop acknowledges it.
  // Immediate delivery keeps the UI responsive; the cron retries any outage.
  mirrorPackageToWhop(ownedPackage.id);
  await revalidateCommercePaths(
    ownedPackage.capper.user.username,
    ownedPackage.capper.user.id,
  );
  return { ok: true };
}

export async function adminSavePackageAction(
  input: AdminPackageInput,
): Promise<ActionResult & { packageId?: string }> {
  const admin = await requireAdmin();
  const parsed = adminPackageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message || "Invalid package.",
    };
  }
  const d = parsed.data;

  const capper = await prisma.capperProfile.findUnique({
    where: { id: d.capperId },
    select: {
      id: true,
      user: { select: { id: true, username: true } },
    },
  });
  if (!capper) return { ok: false, error: "Capper not found." };

  const existingPackage = d.id
    ? await prisma.package.findUnique({
        where: { id: d.id },
        select: {
          capperId: true,
          storeConnectionId: true,
          externalProductId: true,
        },
      })
    : null;
  if (d.id && !existingPackage) {
    return { ok: false, error: "Package not found." };
  }
  if (existingPackage && existingPackage.capperId !== d.capperId) {
    return {
      ok: false,
      error: "Package does not belong to the selected capper.",
    };
  }

  const storeConnectionId =
    d.storeConnectionId ?? existingPackage?.storeConnectionId ?? null;
  if (storeConnectionId) {
    const suppliedConnection = await prisma.storeConnection.findUnique({
      where: { id: storeConnectionId },
      select: { capperId: true, provider: true },
    });
    if (
      !suppliedConnection ||
      suppliedConnection.capperId !== d.capperId ||
      suppliedConnection.provider !== d.affiliateProvider
    ) {
      return {
        ok: false,
        error: "Store connection does not match this capper and provider.",
      };
    }
  }

  const whopPushQueuedAt =
    existingPackage?.externalProductId &&
    d.affiliateProvider === "WHOP" &&
    storeConnectionId
      ? new Date()
      : null;

  const packageId = await prisma.$transaction(async (tx) => {
    const pkg = d.id
      ? await tx.package.update({
          where: { id: d.id },
          data: {
            title: d.title,
            description: d.description?.trim() ? d.description.trim() : null,
            promoOffer: d.promoOffer?.trim() ? d.promoOffer.trim() : null,
            checkoutUrl: d.checkoutUrl,
            affiliateProvider: d.affiliateProvider,
            storeConnectionId,
            priceCents: d.priceCents,
            billingPeriod: d.billingPeriod,
            billingIntervalCount: d.billingIntervalCount,
            sortOrder: d.sortOrder,
            isActive: d.isActive,
            providerType: "PREMIUM",
            whopPushPendingAt: whopPushQueuedAt,
            whopPushAttempts: 0,
            whopPushLastError: null,
          },
        })
      : await tx.package.create({
          data: {
            capperId: d.capperId,
            storeConnectionId,
            title: d.title,
            description: d.description?.trim() ? d.description.trim() : null,
            promoOffer: d.promoOffer?.trim() ? d.promoOffer.trim() : null,
            checkoutUrl: d.checkoutUrl,
            affiliateProvider: d.affiliateProvider,
            priceCents: d.priceCents,
            billingPeriod: d.billingPeriod,
            billingIntervalCount: d.billingIntervalCount,
            sortOrder: d.sortOrder,
            isActive: d.isActive,
            providerType: "PREMIUM",
          },
        });

    const existing = await tx.trackingUrl.findFirst({
      where: { packageId: pkg.id },
      orderBy: { createdAt: "asc" },
    });

    if (existing) {
      await tx.trackingUrl.update({
        where: { id: existing.id },
        data: { targetUrl: d.checkoutUrl },
      });
    } else {
      await tx.trackingUrl.create({
        data: {
          packageId: pkg.id,
          slug: makeTrackingSlug(d.title),
          targetUrl: d.checkoutUrl,
        },
      });
    }

    // Price, title and visibility are revenue-affecting and publicly visible,
    // so every save is attributed. `d.id` distinguishes an edit from a create.
    await tx.packageAuditEvent.create({
      data: {
        packageId: pkg.id,
        capperId: capper.id,
        actorId: admin.id,
        action: d.id ? "UPDATED" : "CREATED",
        summary: `${d.id ? "Updated" : "Created"} "${d.title}" · ${
          d.priceCents > 0
            ? `$${(d.priceCents / 100).toFixed(2)}`
            : "no price shown"
        } · ${d.isActive ? "live" : "hidden"}`,
      },
    });

    if (storeConnectionId) {
      await syncConnectionFromLivePackages(tx, storeConnectionId, admin.id);
    }

    return pkg.id;
  });

  if (whopPushQueuedAt) mirrorPackageToWhop(packageId);
  await revalidateCommercePaths(capper.user.username, capper.user.id);
  return { ok: true, packageId };
}

export async function adminSetPackageActiveAction(
  input: AdminPackageActiveInput,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = adminPackageActiveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const pkg = await prisma.package.findUnique({
    where: { id: parsed.data.packageId },
    select: {
      id: true,
      title: true,
      capperId: true,
      storeConnectionId: true,
      externalProductId: true,
      storeConnection: { select: { provider: true } },
      capper: {
        select: { user: { select: { id: true, username: true } } },
      },
    },
  });
  if (!pkg) return { ok: false, error: "Package not found." };

  const whopPushQueuedAt =
    pkg.externalProductId && pkg.storeConnection?.provider === "WHOP"
      ? new Date()
      : null;

  await prisma.$transaction(async (tx) => {
    await tx.package.update({
      where: { id: pkg.id },
      data: {
        isActive: parsed.data.isActive,
        ...(whopPushQueuedAt && {
          whopPushPendingAt: whopPushQueuedAt,
          whopPushAttempts: 0,
          whopPushLastError: null,
        }),
      },
    });
    // Taking an offer down (or putting one up) changes what the public can buy,
    // so it is attributed like any other storefront decision.
    await tx.packageAuditEvent.create({
      data: {
        packageId: pkg.id,
        capperId: pkg.capperId,
        actorId: admin.id,
        action: parsed.data.isActive ? "ACTIVATED" : "DEACTIVATED",
        summary: `${parsed.data.isActive ? "Published" : "Hid"} "${pkg.title}"`,
      },
    });
    if (pkg.storeConnectionId) {
      await syncConnectionFromLivePackages(tx, pkg.storeConnectionId, admin.id);
    }
  });

  // Publishing or hiding an offer is exactly the change a capper expects to see
  // reflected on their Whop storefront.
  if (whopPushQueuedAt) mirrorPackageToWhop(pkg.id);
  await revalidateCommercePaths(pkg.capper.user.username, pkg.capper.user.id);
  return { ok: true };
}

/**
 * Permanently remove one capper's package.
 *
 * Deletion is not the same tool as hiding, and the difference is not cosmetic:
 * `Package` cascades to `TrackingUrl` (and every `ClickEvent` under it) and to
 * `PlayPackage` / `ParlayPackage`. So deleting an offer that has been sold
 * against destroys its click history *and* the attribution that makes
 * "package results only include picks assigned to that offer" true. A capper's
 * package record would silently change.
 *
 * So: packages with no history delete on one click, because those are the
 * duplicates and typos an admin actually wants gone. Packages with history
 * refuse once and report exactly what would be lost; the caller re-sends with
 * `confirmDestructive` if that is genuinely the intent. `PackageAuditEvent`
 * nulls rather than cascades, so the record of the deletion outlives the
 * package — which is the whole point of an audit trail.
 */
export async function adminDeletePackageAction(
  input: AdminPackageDeleteInput,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = adminPackageDeleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const pkg = await prisma.package.findUnique({
    where: { id: parsed.data.packageId },
    select: {
      id: true,
      title: true,
      priceCents: true,
      capperId: true,
      storeConnectionId: true,
      capper: { select: { user: { select: { id: true, username: true } } } },
      _count: { select: { playLinks: true, parlayLinks: true } },
    },
  });
  if (!pkg) return { ok: false, error: "Package not found." };

  const clicks = await prisma.clickEvent.count({
    where: { trackingUrl: { packageId: pkg.id } },
  });
  const attributed = pkg._count.playLinks + pkg._count.parlayLinks;

  if ((attributed > 0 || clicks > 0) && !parsed.data.confirmDestructive) {
    const losses = [
      attributed > 0 ? `${attributed} attributed pick(s)` : null,
      clicks > 0 ? `${clicks} recorded click(s)` : null,
    ].filter(Boolean);
    return {
      ok: false,
      error: `"${pkg.title}" has history — deleting also removes ${losses.join(
        " and ",
      )}. Hide it instead to keep the record, or confirm to delete permanently.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    // Written before the delete so the row exists to be nulled, not orphaned.
    await tx.packageAuditEvent.create({
      data: {
        packageId: pkg.id,
        capperId: pkg.capperId,
        actorId: admin.id,
        action: "DELETED",
        summary: `Deleted "${pkg.title}" · ${
          pkg.priceCents > 0
            ? `$${(pkg.priceCents / 100).toFixed(2)}`
            : "no price shown"
        }${
          attributed > 0 || clicks > 0
            ? ` · discarded ${attributed} attributed pick(s), ${clicks} click(s)`
            : ""
        }`,
      },
    });
    await tx.package.delete({ where: { id: pkg.id } });
    if (pkg.storeConnectionId) {
      await syncConnectionFromLivePackages(tx, pkg.storeConnectionId, admin.id);
    }
  });

  // Deliberately NOT mirrored to Whop. Removing an SCL listing is a statement
  // about SCL's marketplace; deleting the capper's product on their own Whop
  // storefront is not ours to do, and is not reversible from here.
  await revalidateCommercePaths(pkg.capper.user.username, pkg.capper.user.id);
  return { ok: true };
}

/**
 * Move one package up or down in its capper's display order.
 *
 * Admins build a capper's SCL storefront from the affiliate links right after
 * verifying the connection, so ordering has to be one click — not "open each
 * package and retype a number". Swaps the neighbour's slot inside a transaction
 * and normalizes the whole list to 0..n-1 so mixed/duplicate legacy sortOrder
 * values can't wedge the sequence.
 */
export async function adminReorderPackageAction(
  input: AdminPackageReorderInput,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = adminPackageReorderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const pkg = await prisma.package.findUnique({
    where: { id: parsed.data.packageId },
    select: {
      id: true,
      capperId: true,
      capper: {
        select: { user: { select: { id: true, username: true } } },
      },
    },
  });
  if (!pkg) return { ok: false, error: "Package not found." };

  await prisma.$transaction(async (tx) => {
    const siblings = await tx.package.findMany({
      where: { capperId: pkg.capperId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: { id: true },
    });
    const index = siblings.findIndex((s) => s.id === pkg.id);
    const target = parsed.data.direction === "UP" ? index - 1 : index + 1;
    // Already at the boundary — normalize only, never throw.
    if (index !== -1 && target >= 0 && target < siblings.length) {
      [siblings[index], siblings[target]] = [
        siblings[target]!,
        siblings[index]!,
      ];
    }
    for (const [order, sibling] of siblings.entries()) {
      await tx.package.update({
        where: { id: sibling.id },
        data: { sortOrder: order },
      });
    }
    // Display order decides which offer a visitor sees first, so it is
    // attributed too — one event for the move, not one per sibling rewritten.
    await tx.packageAuditEvent.create({
      data: {
        packageId: pkg.id,
        capperId: pkg.capperId,
        actorId: admin.id,
        action: "REORDERED",
        summary: `Moved ${parsed.data.direction === "UP" ? "up" : "down"} in display order`,
      },
    });
  });

  await revalidateCommercePaths(pkg.capper.user.username, pkg.capper.user.id);
  return { ok: true };
}

export async function adminSyncWhopStorefrontAction(input: {
  connectionId: string;
}): Promise<
  | { ok: true; imported: number; updated: number; skipped: number }
  | { ok: false; error: string }
> {
  const admin = await requireAdmin();
  if (!input.connectionId.trim()) {
    return { ok: false, error: "Invalid store connection." };
  }
  if (!whopOAuthConfigured()) {
    return {
      ok: false,
      error:
        "Whop OAuth is not configured. Set WHOP_APP_ID and WHOP_APP_API_KEY in production.",
    };
  }
  if (!whopAffiliateUsername()) {
    return {
      ok: false,
      error:
        "WHOP_AFFILIATE_USERNAME is not configured — sync cannot build attributed links.",
    };
  }

  const connection = await prisma.storeConnection.findUnique({
    where: { id: input.connectionId },
    select: {
      id: true,
      provider: true,
      capper: { select: { user: { select: { id: true, username: true } } } },
    },
  });
  if (!connection) return { ok: false, error: "Store connection not found." };
  if (connection.provider !== "WHOP") {
    return { ok: false, error: "Only Whop storefronts can sync from Whop." };
  }

  const result = await syncWhopStorefront({
    storeConnectionId: connection.id,
    actorId: admin.id,
  });
  if (!result.ok) return result;

  await revalidateCommercePaths(
    connection.capper.user.username,
    connection.capper.user.id,
  );
  return result;
}
