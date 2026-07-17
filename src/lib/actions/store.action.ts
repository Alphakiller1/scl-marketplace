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

type ActionResult = { ok: true } | { ok: false; error: string };

/** Statuses that package save/activate must never auto-override. */
const LOCKED_STORE_STATUSES = new Set(["DISABLED", "NEEDS_ACTION"]);

async function revalidateCommercePaths(username?: string | null) {
  revalidatePath("/dashboard/monetization");
  revalidatePath("/admin/store-setup");
  revalidatePath("/admin/packages");
  revalidatePath("/packages");
  if (username) revalidatePath(`/cappers/${username}`);
}

/**
 * Keep import + connection status in sync with live package count,
 * without clobbering admin-locked statuses (Disabled / Needs Action).
 */
async function syncConnectionFromLivePackages(
  tx: Prisma.TransactionClient,
  storeConnectionId: string,
) {
  const [liveCount, conn] = await Promise.all([
    tx.package.count({
      where: { storeConnectionId, isActive: true },
    }),
    tx.storeConnection.findUnique({
      where: { id: storeConnectionId },
      select: { status: true },
    }),
  ]);
  if (!conn) return;

  const packageImportStatus = liveCount > 0 ? "LIVE" : "IMPORTED";
  if (LOCKED_STORE_STATUSES.has(conn.status)) {
    await tx.storeConnection.update({
      where: { id: storeConnectionId },
      data: { packageImportStatus },
    });
    return;
  }

  await tx.storeConnection.update({
    where: { id: storeConnectionId },
    data: {
      packageImportStatus,
      status: liveCount > 0 ? "LIVE" : "PACKAGES_IMPORTED",
    },
  });
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

  await prisma.storeConnection.upsert({
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
    update: {
      status: "INSTRUCTIONS_VIEWED",
    },
  });

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

  await prisma.storeConnection.upsert({
    where: {
      capperId_provider: {
        capperId: profile.id,
        provider: parsed.data.provider,
      },
    },
    create: {
      capperId: profile.id,
      provider: parsed.data.provider,
      status,
      packageImportStatus: "NOT_STARTED",
      submittedAt: now,
      acknowledgmentAt: now,
    },
    update: {
      status,
      submittedAt: now,
      acknowledgmentAt: now,
    },
  });

  await revalidateCommercePaths(profile.user.username);
  return { ok: true };
}

export async function adminUpdateStoreConnectionAction(
  input: AdminUpdateStoreConnectionInput,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = adminUpdateStoreConnectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const conn = await prisma.storeConnection.findUnique({
    where: { id: parsed.data.connectionId },
    select: {
      id: true,
      capper: { select: { user: { select: { username: true } } } },
    },
  });
  if (!conn) return { ok: false, error: "Store request not found." };

  const patch =
    parsed.data.action === "LINKS_RECEIVED"
      ? {
          status: "LINKS_RECEIVED" as const,
          packageImportStatus: "LINKS_RECEIVED" as const,
          adminNotes: parsed.data.adminNotes,
        }
      : parsed.data.action === "NEEDS_ACTION"
        ? {
            status: "NEEDS_ACTION" as const,
            adminNotes: parsed.data.adminNotes,
          }
        : parsed.data.action === "DISABLED"
          ? {
              status: "DISABLED" as const,
              adminNotes: parsed.data.adminNotes,
            }
          : {
              status: "LIVE" as const,
              packageImportStatus: "LIVE" as const,
              adminNotes: parsed.data.adminNotes,
            };

  await prisma.storeConnection.update({
    where: { id: conn.id },
    data: {
      ...patch,
      ...(parsed.data.adminNotes != null
        ? { adminNotes: parsed.data.adminNotes }
        : {}),
    },
  });

  await revalidateCommercePaths(conn.capper.user.username);
  return { ok: true };
}

export async function adminSavePackageAction(
  input: AdminPackageInput,
): Promise<ActionResult & { packageId?: string }> {
  await requireAdmin();
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
    select: { id: true, user: { select: { username: true } } },
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
      await syncConnectionFromLivePackages(tx, storeConnectionId);
    }

    return pkg.id;
  });

  await revalidateCommercePaths(capper.user.username);
  return { ok: true, packageId };
}

export async function adminSetPackageActiveAction(
  input: AdminPackageActiveInput,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = adminPackageActiveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const pkg = await prisma.package.findUnique({
    where: { id: parsed.data.packageId },
    select: {
      id: true,
      storeConnectionId: true,
      capper: { select: { user: { select: { username: true } } } },
    },
  });
  if (!pkg) return { ok: false, error: "Package not found." };

  await prisma.$transaction(async (tx) => {
    await tx.package.update({
      where: { id: pkg.id },
      data: { isActive: parsed.data.isActive },
    });
    if (pkg.storeConnectionId) {
      await syncConnectionFromLivePackages(tx, pkg.storeConnectionId);
    }
  });

  await revalidateCommercePaths(pkg.capper.user.username);
  return { ok: true };
}
