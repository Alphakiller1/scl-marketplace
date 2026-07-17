import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { makeTrackingSlug } from "@/lib/store-connection";

export const runtime = "nodejs";

const TITLE = "SCL Smoke E2E Package";
const AFFILIATE_URL = "https://whop.com/checkout/plan_scl_smoke_e2e";

/**
 * Authenticated admin helper for store-setup e2e smoke.
 * Creates/updates a Whop pending→live connection + package for the signed-in admin.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, error: "Admin only." },
      { status: 403 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, username: true },
  });
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "User not found." },
      { status: 404 },
    );
  }

  let capper = await prisma.capperProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!capper) {
    capper = await prisma.capperProfile.create({
      data: {
        userId: user.id,
        storefrontEnabled: true,
        storefrontTitle: "Chase Storefront",
      },
      select: { id: true },
    });
  }

  const now = new Date();
  const connection = await prisma.storeConnection.upsert({
    where: {
      capperId_provider: { capperId: capper.id, provider: "WHOP" },
    },
    create: {
      capperId: capper.id,
      provider: "WHOP",
      status: "PENDING_SCL_LINK_IMPORT",
      packageImportStatus: "NOT_STARTED",
      submittedAt: now,
      acknowledgmentAt: now,
    },
    update: {
      status: "PENDING_SCL_LINK_IMPORT",
      packageImportStatus: "NOT_STARTED",
      submittedAt: now,
      acknowledgmentAt: now,
    },
  });

  const existing = await prisma.package.findFirst({
    where: { capperId: capper.id, title: TITLE },
    select: { id: true },
  });

  const pkg = existing
    ? await prisma.package.update({
        where: { id: existing.id },
        data: {
          storeConnectionId: connection.id,
          affiliateProvider: "WHOP",
          description: "E2E smoke package — safe to deactivate.",
          promoOffer: "7-day free trial",
          checkoutUrl: AFFILIATE_URL,
          priceCents: 9900,
          billingPeriod: "MONTH",
          sortOrder: 0,
          isActive: true,
        },
      })
    : await prisma.package.create({
        data: {
          capperId: capper.id,
          storeConnectionId: connection.id,
          affiliateProvider: "WHOP",
          title: TITLE,
          description: "E2E smoke package — safe to deactivate.",
          promoOffer: "7-day free trial",
          checkoutUrl: AFFILIATE_URL,
          priceCents: 9900,
          billingPeriod: "MONTH",
          sortOrder: 0,
          isActive: true,
          providerType: "PREMIUM",
        },
      });

  const existingTrack = await prisma.trackingUrl.findFirst({
    where: { packageId: pkg.id },
    orderBy: { createdAt: "asc" },
  });
  const tracking = existingTrack
    ? await prisma.trackingUrl.update({
        where: { id: existingTrack.id },
        data: { targetUrl: AFFILIATE_URL },
      })
    : await prisma.trackingUrl.create({
        data: {
          packageId: pkg.id,
          slug: makeTrackingSlug("scl-smoke-e2e"),
          targetUrl: AFFILIATE_URL,
        },
      });

  await prisma.storeConnection.update({
    where: { id: connection.id },
    data: { status: "LIVE", packageImportStatus: "LIVE" },
  });

  return NextResponse.json({
    ok: true,
    connectionId: connection.id,
    packageId: pkg.id,
    trackingSlug: tracking.slug,
    trackingPath: `/go/${tracking.slug}`,
    profilePath: user.username ? `/cappers/${user.username}` : null,
    title: TITLE,
    affiliateUrl: AFFILIATE_URL,
  });
}
