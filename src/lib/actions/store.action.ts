"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAdmin, requireCapperAccess } from "@/lib/session";
import {
  adminPackageActiveSchema,
  adminPackageSchema,
  adminUpdateStoreConnectionSchema,
  markInstructionsViewedSchema,
  submitStoreConnectionSchema,
  type AdminPackageActiveInput,
  type AdminPackageInput,
  type AdminUpdateStoreConnectionInput,
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

type ActionResult = { ok: true } | { ok: false; error: string };

async function revalidateCommercePaths(
  username?: string | null,
  capperUserId?: string | null,
) {
  revalidatePath("/dashboard/monetization");
  revalidatePath("/admin/store-setup");
  revalidatePath("/admin/packages");
  revalidatePath("/admin/cappers");
  revalidatePath("/packages");
  if (capperUserId) revalidatePath(`/admin/cappers/${capperUserId}`);
  if (username) revalidatePath(`/cappers/${username.replace(/^@/, "")}`);
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
        packageCount: true,
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
      // update lastImportedAt when packages are imported or storefront is live
      lastImportedAt:
        readiness.packageImportStatus === "IMPORTED" ||
        readiness.packageImportStatus === "LIVE"
          ? now
          : conn.packageCount !== packageCount
          ? now
          : undefined,
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

  revalidatePath("/dashboard/monetization");
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
    select: { id: true, user: { select: { username: true } } },
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
    },
  });
  if (updated.count !== 1) {
    return {
      ok: false,
      error: "The storefront changed while submitting. Refresh its status.",
    };
  }

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
        // workflow tracking fields
        packageCount: packageCount,
        affiliateAcceptedAt:
          parsed.data.action === "APPROVE" ? now : undefined,
        lastImportedAt:
          packageImportStatus === "IMPORTED" || packageImportStatus === "LIVE"
            ? now
            : undefined,
        requiresAttention: transition.targetStatus === "NEEDS_ACTION",
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

  let storeConnectionId = d.storeConnectionId || null;
  if (!storeConnectionId) {
    const conn = await prisma.storeConnection.findUnique({
      where: {
        capperId_provider: {
          capperId: d.capperId,
          provider: d.affiliateProvider,
        },
      },
      select: { id: true },
    });
    storeConnectionId = conn?.id ?? null;
  }

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
            sortOrder: d.sortOrder,
            isActive: d.isActive,
            providerType: "PREMIUM",
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

    if (storeConnectionId) {
      await syncConnectionFromLivePackages(tx, storeConnectionId, admin.id);
    }

    return pkg.id;
  });

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
      storeConnectionId: true,
      capper: {
        select: { user: { select: { id: true, username: true } } },
      },
    },
  });
  if (!pkg) return { ok: false, error: "Package not found." };

  await prisma.$transaction(async (tx) => {
    await tx.package.update({
      where: { id: pkg.id },
      data: { isActive: parsed.data.isActive },
    });
    if (pkg.storeConnectionId) {
      await syncConnectionFromLivePackages(tx, pkg.storeConnectionId, admin.id);
    }
  });

  await revalidateCommercePaths(pkg.capper.user.username, pkg.capper.user.id);
  return { ok: true };
}
