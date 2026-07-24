"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import {
  recordPackageSaleSchema,
  updateCapperCommerceSchema,
  updatePackageSaleStatusSchema,
  updatePlatformCommerceSchema,
  type RecordPackageSaleInput,
  type UpdateCapperCommerceInput,
  type UpdatePackageSaleStatusInput,
  type UpdatePlatformCommerceInput,
} from "@/lib/schemas/admin-commerce-phase-c.schema";
import { resolveSaleAffiliate } from "@/lib/queries/admin-sales";
import { requireAdmin } from "@/lib/session";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function updatePlatformCommerceAction(
  input: UpdatePlatformCommerceInput,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = updatePlatformCommerceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check commerce settings.",
    };
  }

  await prisma.platformCommerceSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      nativeStoreEnabled: parsed.data.nativeStoreEnabled,
      platformAffiliatePercent: parsed.data.platformAffiliatePercent,
      updatedById: admin.id,
    },
    update: {
      nativeStoreEnabled: parsed.data.nativeStoreEnabled,
      platformAffiliatePercent: parsed.data.platformAffiliatePercent,
      updatedById: admin.id,
    },
  });

  revalidatePath("/admin/store");
  revalidatePath("/admin/sales");
  return { ok: true };
}

export async function updateCapperCommerceAction(
  input: UpdateCapperCommerceInput,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = updateCapperCommerceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check capper commerce fields.",
    };
  }

  const settings = await prisma.platformCommerceSettings.findUnique({
    where: { id: "default" },
    select: { nativeStoreEnabled: true },
  });
  if (parsed.data.nativeStoreEnabled && !settings?.nativeStoreEnabled) {
    return {
      ok: false,
      error:
        "Enable the platform native store before approving capper storefronts.",
    };
  }

  await prisma.capperProfile.update({
    where: { id: parsed.data.capperProfileId },
    data: {
      nativeStoreEnabled: parsed.data.nativeStoreEnabled,
      defaultAffiliatePercent: parsed.data.defaultAffiliatePercent ?? null,
      lastReviewedAt: new Date(),
      lastReviewedById: admin.id,
    },
  });

  revalidatePath("/admin/store");
  revalidatePath("/admin/storefronts");
  return { ok: true };
}

export async function recordPackageSaleAction(
  input: RecordPackageSaleInput,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = recordPackageSaleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the sale fields.",
    };
  }

  const affiliate = await resolveSaleAffiliate({
    packageId: parsed.data.packageId,
    grossCents: parsed.data.grossCents,
    overridePercent: parsed.data.affiliatePercent,
  });
  if (!affiliate) return { ok: false, error: "Package not found." };

  let customerProfileId: string | null = null;
  if (parsed.data.customerUserId) {
    const profile = await prisma.customerProfile.findUnique({
      where: { userId: parsed.data.customerUserId },
      select: { id: true },
    });
    customerProfileId = profile?.id ?? null;
  }

  await prisma.packageSale.create({
    data: {
      packageId: parsed.data.packageId,
      customerUserId: parsed.data.customerUserId || null,
      customerProfileId,
      clickEventId: parsed.data.clickEventId || null,
      source: parsed.data.source,
      status: parsed.data.status,
      grossCents: parsed.data.grossCents,
      affiliatePercent: affiliate.affiliatePercent,
      affiliateCents: affiliate.affiliateCents,
      externalOrderId: parsed.data.externalOrderId || null,
      purchasedAt: parsed.data.purchasedAt
        ? new Date(parsed.data.purchasedAt)
        : new Date(),
      notes: parsed.data.notes || null,
      recordedById: admin.id,
    },
  });

  revalidatePath("/admin/sales");
  revalidatePath("/admin/analytics");
  return { ok: true };
}

export async function updatePackageSaleStatusAction(
  input: UpdatePackageSaleStatusInput,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = updatePackageSaleStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Sale update is invalid." };
  }

  await prisma.packageSale.update({
    where: { id: parsed.data.saleId },
    data: { status: parsed.data.status },
  });

  revalidatePath("/admin/sales");
  revalidatePath("/admin/analytics");
  return { ok: true };
}
