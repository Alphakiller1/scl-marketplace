import type { Metadata } from "next";

import { appUrl } from "@/lib/app-url";
import { SCL_BRAND_NAME } from "@/lib/brand";
import { formatHandle, identityDisplayLinesFromCapper } from "@/lib/identity";
import { isBuildingARecord } from "@/lib/leaderboard";
import type { CapperSummary } from "@/lib/mock";

/**
 * Capper profile SEO — templates stay keyword-natural without hype claims.
 * Includes dynamic OG card from /api/og/capper/[handle].
 */
export function buildCapperProfileMetadata(capper: CapperSummary): Metadata {
  const identity = identityDisplayLinesFromCapper(capper);
  const name =
    identity.primary ||
    formatHandle(capper.handle) ||
    capper.handle ||
    "Capper";
  const bare = capper.handle.replace(/^@+/, "");
  const base = appUrl();
  const pageUrl = `${base}/cappers/${bare}`;
  const ogImage = `${base}/api/og/capper/${bare}`;
  const building = isBuildingARecord({
    rank: capper.rank,
    settledPicks: capper.settledPicks,
    units: capper.units,
    roi: capper.roi,
  });

  const sport = capper.topSport?.trim();
  const title =
    sport && sport.toUpperCase() !== "MULTI"
      ? `${name} ${sport} Capper Record & Pick History`
      : `${name} Record, Picks & Verified History`;

  const description = building
    ? `Review ${name}'s building record on SCL, including graded picks, timestamps, verification status, and storefront links where available.`
    : `Review ${name}'s public capper record, graded picks, units, ROI, timestamps, and verification status on ${SCL_BRAND_NAME}.`;

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      title,
      description,
      url: pageUrl,
      type: "profile",
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

/**
 * Metadata that never hydrates the full profile.
 *
 * Next renders metadata alongside the page. Calling the full profile loader
 * from both paths creates two concurrent cache misses on a cold request, which
 * can exhaust a one-connection serverless pool before either render finishes.
 */
export function buildCapperHandleMetadata(handle: string): Metadata {
  const bare = handle.replace(/^@+/, "").trim();
  const name = formatHandle(bare) || "Capper";
  const base = appUrl();
  const encoded = encodeURIComponent(bare);
  const pageUrl = `${base}/cappers/${encoded}`;
  const ogImage = `${base}/api/og/capper/${encoded}`;
  const title = `${name} Record, Picks & Verified History`;
  const description = `Review ${name}'s public capper profile, graded picks, units, ROI, timestamps, verification status, and storefront links where available on ${SCL_BRAND_NAME}.`;

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      title,
      description,
      url: pageUrl,
      type: "profile",
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}
