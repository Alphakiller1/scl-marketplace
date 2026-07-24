"use server";

import { revalidatePath } from "next/cache";

import { deriveStorefrontStatus, packageTrackingSlug } from "@/lib/commerce";
import { prisma } from "@/lib/prisma";
import {
  adminStorefrontUpdateSchema,
  type AdminStorefrontUpdateInput,
} from "@/lib/schemas/admin-storefront.schema";
import {
  adminPackageDeleteSchema,
  adminPackageUpsertSchema,
  type AdminPackageDeleteInput,
  type AdminPackageUpsertInput,
} from "@/lib/schemas/admin-package.schema";
import { requireAdmin } from "@/lib/session";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateAdminStorefrontAction(
  input: AdminStorefrontUpdateInput,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = adminStorefrontUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the storefront fields.",
    };
  }

  const profile = await prisma.capperProfile.findUnique({
    where: { id: parsed.data.capperProfileId },
    select: { id: true },
  });
  if (!profile) return { ok: false, error: "Capper profile not found." };

  await prisma.capperProfile.update({
    where: { id: profile.id },
    data: {
      commercePlatform: parsed.data.commercePlatform,
      storefrontStatus: parsed.data.storefrontStatus,
      adminNotes: parsed.data.adminNotes?.trim() || null,
      lastReviewedAt: new Date(),
      lastReviewedById: admin.id,
    },
  });

  revalidatePath("/admin/storefronts");
  revalidatePath(`/admin/storefronts/${profile.id}`);
  revalidatePath("/admin/cappers");
  revalidatePath("/admin");
  return { ok: true };
}

export async function upsertAdminPackageAction(
  input: AdminPackageUpsertInput,
): Promise<ActionResult & { packageId?: string }> {
  const admin = await requireAdmin();
  const parsed = adminPackageUpsertSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the package fields.",
    };
  }

  const profile = await prisma.capperProfile.findUnique({
    where: { id: parsed.data.capperProfileId },
    select: {
      id: true,
      user: { select: { username: true } },
    },
  });
  if (!profile?.user.username) {
    return { ok: false, error: "Capper profile not found." };
  }

  const checkoutUrl = parsed.data.checkoutUrl?.trim() || null;
  const now = new Date();
  const visibility = parsed.data.visibility;
  const goingLive = visibility === "LIVE" && Boolean(checkoutUrl);

  const baseData = {
    title: parsed.data.title,
    description: parsed.data.description?.trim() || null,
    priceCents: parsed.data.priceCents,
    billingPeriod: parsed.data.billingPeriod,
    checkoutUrl,
    trialTerms: parsed.data.trialTerms?.trim() || null,
    displayOrder: parsed.data.displayOrder,
    visibility,
    affiliatePercent: parsed.data.affiliatePercent ?? null,
    isActive: visibility !== "HIDDEN",
    suspendedAt: null,
    suspendedReason: null,
    ...(goingLive
      ? { approvedAt: now, approvedById: admin.id }
      : { approvedAt: null, approvedById: null }),
  };

  let packageId = parsed.data.id;
  if (packageId) {
    const existing = await prisma.package.findFirst({
      where: { id: packageId, capperId: profile.id },
      select: { id: true },
    });
    if (!existing) return { ok: false, error: "Package not found." };
    await prisma.package.update({
      where: { id: packageId },
      data: baseData,
    });
  } else {
    const created = await prisma.package.create({
      data: { capperId: profile.id, ...baseData },
      select: { id: true },
    });
    packageId = created.id;
  }

  if (checkoutUrl && packageId) {
    const slug = packageTrackingSlug(profile.user.username, packageId);
    const tracking = await prisma.trackingUrl.findFirst({
      where: { packageId },
      select: { id: true, slug: true },
    });
    if (tracking) {
      await prisma.trackingUrl.update({
        where: { id: tracking.id },
        data: { targetUrl: checkoutUrl },
      });
    } else {
      await prisma.trackingUrl.create({
        data: { packageId, slug, targetUrl: checkoutUrl },
      });
    }
  }

  const liveCount = await prisma.package.count({
    where: {
      capperId: profile.id,
      visibility: "LIVE",
      suspendedAt: null,
      checkoutUrl: { not: null },
    },
  });

  await prisma.capperProfile.update({
    where: { id: profile.id },
    data: {
      lastReviewedAt: now,
      lastReviewedById: admin.id,
      storefrontStatus: deriveStorefrontStatus({
        current: "APPROVED",
        livePackageCount: liveCount,
      }),
    },
  });

  revalidatePath("/admin/storefronts");
  revalidatePath(`/admin/storefronts/${profile.id}`);
  revalidatePath("/admin/analytics");
  revalidatePath(`/cappers/${profile.user.username}`);

  return { ok: true, packageId };
}

export async function deleteAdminPackageAction(
  input: AdminPackageDeleteInput,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = adminPackageDeleteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Package is required." };
  }

  const pkg = await prisma.package.findUnique({
    where: { id: parsed.data.packageId },
    select: {
      id: true,
      capperId: true,
      capper: { select: { user: { select: { username: true } } } },
    },
  });
  if (!pkg) return { ok: false, error: "Package not found." };

  await prisma.package.delete({ where: { id: pkg.id } });

  const liveCount = await prisma.package.count({
    where: {
      capperId: pkg.capperId,
      visibility: "LIVE",
      suspendedAt: null,
      checkoutUrl: { not: null },
    },
  });

  await prisma.capperProfile.update({
    where: { id: pkg.capperId },
    data: {
      lastReviewedAt: new Date(),
      lastReviewedById: admin.id,
      storefrontStatus: liveCount > 0 ? "STOREFRONT_LIVE" : "APPROVED",
    },
  });

  revalidatePath("/admin/storefronts");
  revalidatePath(`/admin/storefronts/${pkg.capperId}`);
  revalidatePath("/admin/analytics");
  if (pkg.capper.user.username) {
    revalidatePath(`/cappers/${pkg.capper.user.username}`);
  }
  return { ok: true };
}
