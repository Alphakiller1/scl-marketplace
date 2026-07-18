import "server-only";

import type { VerificationTier } from "@prisma/client";

import { summarizeClvTracker, type ClvTrackerSummary } from "@/lib/clv-tracker";
import { UNIT_MIN } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { prismaExcludeTestHandles } from "@/lib/public-eligibility";
import { hasClvColumns } from "@/lib/results/schema-features";

const VERIFIED_TIERS: VerificationTier[] = ["VERIFIED", "AUTO_VERIFIED"];

export type PlatformClvResult = {
  summary: ClvTrackerSummary;
  failed: boolean;
};

/**
 * Platform CLV — READ stored clvPts only, same publicly listed + board-verified
 * gate as the leaderboard / platform activity report.
 */
export async function getPlatformClvSummary(): Promise<PlatformClvResult> {
  const empty = summarizeClvTracker([]);
  try {
    const clvReady = await hasClvColumns();
    if (!clvReady) {
      return { summary: empty, failed: false };
    }

    const rows = await prisma.play.findMany({
      where: {
        clvPts: { not: null },
        units: { gte: UNIT_MIN },
        verificationTier: { in: VERIFIED_TIERS },
        outcome: { not: "PENDING" },
        parlayId: null,
        capper: {
          user: {
            accountStatus: "ACTIVE",
            username: { not: null },
            ...prismaExcludeTestHandles(),
          },
        },
      },
      select: { clvPts: true },
    });

    const pts = rows
      .map((r) => (r.clvPts == null ? null : Number(r.clvPts)))
      .filter((v): v is number => v != null && Number.isFinite(v));

    return { summary: summarizeClvTracker(pts), failed: false };
  } catch (error) {
    console.error("[getPlatformClvSummary] database unavailable:", error);
    return { summary: empty, failed: true };
  }
}
