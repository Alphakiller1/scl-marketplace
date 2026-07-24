import "server-only";

import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

export type StorefrontHealthIssue = {
  capperProfileId: string;
  handle: string;
  email: string;
  issues: string[];
};

export type StorefrontHealthOptions = {
  staleReviewDays?: number;
  zeroClickDays?: number;
};

export async function scanStorefrontHealth(
  options: StorefrontHealthOptions = {},
): Promise<StorefrontHealthIssue[]> {
  const staleReviewDays = options.staleReviewDays ?? 30;
  const zeroClickDays = options.zeroClickDays ?? 14;
  const now = Date.now();
  const staleCutoff = new Date(now - staleReviewDays * DAY_MS);
  const clickCutoff = new Date(now - zeroClickDays * DAY_MS);

  const profiles = await prisma.capperProfile.findMany({
    where: {
      user: { role: "CAPPER" },
    },
    select: {
      id: true,
      storefrontStatus: true,
      lastReviewedAt: true,
      adminNotes: true,
      user: { select: { email: true, username: true } },
      packages: {
        select: {
          id: true,
          title: true,
          visibility: true,
          checkoutUrl: true,
          approvedAt: true,
          trackingUrls: {
            select: {
              _count: { select: { clicks: true } },
            },
          },
        },
      },
    },
  });

  const flagged: StorefrontHealthIssue[] = [];

  for (const profile of profiles) {
    const issues: string[] = [];
    const handle = profile.user.username
      ? `@${profile.user.username.replace(/^@/, "")}`
      : profile.user.email;
    const livePackages = profile.packages.filter(
      (pkg) => pkg.visibility === "LIVE",
    );

    if (
      profile.storefrontStatus === "STOREFRONT_LIVE" &&
      livePackages.length === 0
    ) {
      issues.push("Storefront marked live but no live packages are listed.");
    }

    for (const pkg of livePackages) {
      if (!pkg.checkoutUrl) {
        issues.push(`Live package "${pkg.title}" is missing a checkout URL.`);
      }
      const clicks = pkg.trackingUrls.reduce(
        (sum, url) => sum + url._count.clicks,
        0,
      );
      if (pkg.approvedAt && pkg.approvedAt <= clickCutoff && clicks === 0) {
        issues.push(
          `Live package "${pkg.title}" has zero tracked clicks after ${zeroClickDays} days.`,
        );
      }
      if (pkg.checkoutUrl && pkg.trackingUrls.length === 0) {
        issues.push(
          `Live package "${pkg.title}" is missing an SCL tracking redirect.`,
        );
      }
    }

    const hasCommerceActivity =
      livePackages.length > 0 ||
      profile.storefrontStatus === "STOREFRONT_LIVE" ||
      profile.storefrontStatus === "APPROVED";

    if (
      hasCommerceActivity &&
      (!profile.lastReviewedAt || profile.lastReviewedAt < staleCutoff)
    ) {
      issues.push(
        `Storefront has not been reviewed in the last ${staleReviewDays} days.`,
      );
    }

    if (issues.length) {
      flagged.push({
        capperProfileId: profile.id,
        handle,
        email: profile.user.email,
        issues,
      });
    }
  }

  return flagged;
}

export async function applyStorefrontHealthFlags(
  issues: StorefrontHealthIssue[],
  reviewerId: string,
) {
  const now = new Date();
  let updated = 0;

  for (const row of issues) {
    const profile = await prisma.capperProfile.findUnique({
      where: { id: row.capperProfileId },
      select: { adminNotes: true, storefrontStatus: true },
    });
    if (!profile) continue;

    const stamp = `[health ${now.toISOString().slice(0, 10)}] ${row.issues.join(" ")}`;
    const notes = profile.adminNotes
      ? `${profile.adminNotes}\n${stamp}`
      : stamp;

    await prisma.capperProfile.update({
      where: { id: row.capperProfileId },
      data: {
        storefrontStatus: "NEEDS_ATTENTION",
        adminNotes: notes.slice(0, 2000),
        lastReviewedAt: now,
        lastReviewedById: reviewerId,
      },
    });
    updated += 1;
  }

  return updated;
}
