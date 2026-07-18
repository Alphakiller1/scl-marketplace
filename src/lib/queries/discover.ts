import "server-only";

import { prisma } from "@/lib/prisma";
import { UNIT_MIN } from "@/lib/constants";
import { prismaExcludeTestHandlesLive } from "@/lib/public-eligibility-prisma";
import { hasClvColumns } from "@/lib/results/schema-features";
import { computeCapperStats } from "@/lib/stats";
import {
  computeVerifiedShare,
  type VerificationTier,
} from "@/lib/verification";
import { resolveStorefrontIdentity } from "@/lib/storefront";
import { computeCapperActivity } from "@/lib/capper-activity";
import { buildPerformanceTrend } from "@/lib/leaderboard";
import type { CapperSummary, FormResult } from "@/lib/mock";
import {
  buildAllDiscoverLanes,
  type DiscoverCapperInput,
  type DiscoverLaneResult,
  type DiscoverPlayRow,
} from "@/lib/discover-lanes";
import type { Outcome } from "@prisma/client";

function topSport(sports: string[], fallback?: string): string {
  if (sports.length === 0) return fallback ?? "—";
  const counts = new Map<string, number>();
  for (const s of sports) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function deriveForm(settled: Outcome[]): {
  recentForm: FormResult[];
  streak: number;
} {
  const forms = settled.map((o) =>
    o === "WIN" ? "W" : o === "LOSS" ? "L" : "P",
  ) as FormResult[];

  let streak = 0;
  for (let i = forms.length - 1; i >= 0; i--) {
    const f = forms[i];
    if (f === "P") continue;
    if (streak === 0) streak = f === "W" ? 1 : -1;
    else if (streak > 0 && f === "W") streak++;
    else if (streak < 0 && f === "L") streak--;
    else break;
  }

  return { recentForm: forms.slice(-6), streak };
}

/**
 * Public Discover lanes — same public-listed eligibility as the leaderboard.
 * Honest empties when cold start leaves lanes thin; never fabricates rows.
 */
export async function getDiscoverLanes(): Promise<{
  lanes: DiscoverLaneResult[];
  failed: boolean;
}> {
  try {
    const clvReady = await hasClvColumns();
    const excludeTest = await prismaExcludeTestHandlesLive();
    const profiles = await prisma.capperProfile.findMany({
      where: {
        user: {
          username: { not: null },
          accountStatus: "ACTIVE",
          ...excludeTest,
        },
      },
      select: {
        id: true,
        avatarUrl: true,
        bannerUrl: true,
        headline: true,
        bio: true,
        specialties: true,
        storefrontTitle: true,
        storefrontDescription: true,
        storefrontEnabled: true,
        isLegacy: true,
        sports: true,
        books: true,
        createdAt: true,
        user: {
          select: { username: true, emailVerified: true },
        },
        plays: {
          where: {
            parlayId: null,
            units: { gte: UNIT_MIN },
          },
          select: {
            outcome: true,
            units: true,
            profitUnits: true,
            sport: true,
            market: true,
            createdAt: true,
            gradedAt: true,
            verificationTier: true,
            ...(clvReady ? { clvPts: true } : {}),
          },
          orderBy: { createdAt: "asc" },
        },
        parlays: {
          where: { units: { gte: UNIT_MIN } },
          select: {
            outcome: true,
            units: true,
            profitUnits: true,
            createdAt: true,
            gradedAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const inputs: DiscoverCapperInput[] = [];

    for (const p of profiles) {
      const username = p.user.username;
      if (!username) continue;

      const playRows: DiscoverPlayRow[] = p.plays.map((pl) => ({
        outcome: pl.outcome,
        units: Number(pl.units),
        profitUnits: pl.profitUnits == null ? null : Number(pl.profitUnits),
        sport: pl.sport,
        market: pl.market,
        createdAt: pl.createdAt,
        gradedAt: pl.gradedAt,
        verificationTier: pl.verificationTier as VerificationTier,
        clvPts:
          clvReady && "clvPts" in pl && pl.clvPts != null
            ? Number(pl.clvPts)
            : null,
      }));

      // Headline all-time stats include parlays (positions of record), matching
      // the leaderboard. Specialty / verified-month / CLV use straight plays.
      const positions = [
        ...playRows.map((pl) => ({
          outcome: pl.outcome,
          units: pl.units,
          profitUnits: pl.profitUnits,
          createdAt: pl.createdAt,
          gradedAt: pl.gradedAt,
        })),
        ...p.parlays.map((pa) => ({
          outcome: pa.outcome,
          units: Number(pa.units),
          profitUnits: pa.profitUnits == null ? null : Number(pa.profitUnits),
          createdAt: pa.createdAt,
          gradedAt: pa.gradedAt,
        })),
      ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      const stats = computeCapperStats(
        positions.map((x) => ({
          outcome: x.outcome,
          units: x.units,
          profitUnits: x.profitUnits,
        })),
      );
      const performanceTrend = buildPerformanceTrend(
        positions.map((x) => ({
          outcome: x.outcome,
          profitUnits: x.profitUnits,
        })),
      );
      const settledOutcomes = positions
        .filter(
          (x) =>
            x.outcome === "WIN" || x.outcome === "LOSS" || x.outcome === "PUSH",
        )
        .sort(
          (a, b) =>
            (a.gradedAt ?? a.createdAt).getTime() -
            (b.gradedAt ?? b.createdAt).getTime(),
        )
        .map((x) => x.outcome);
      const { recentForm, streak } = deriveForm(settledOutcomes);

      const clvValues = playRows
        .map((pl) => pl.clvPts)
        .filter((v): v is number => v != null && Number.isFinite(v));
      const avgClv =
        clvValues.length > 0
          ? clvValues.reduce((a, b) => a + b, 0) / clvValues.length
          : null;

      const summary: CapperSummary = {
        id: p.id,
        name: username,
        handle: username,
        displayName: null,
        avatarUrl: p.avatarUrl ?? undefined,
        bannerUrl: p.bannerUrl ?? undefined,
        verified: p.user.emailVerified != null,
        topSport: topSport(
          playRows.map((x) => x.sport),
          p.sports[0],
        ),
        rank: 0,
        rankDelta: 0,
        record: { w: stats.wins, l: stats.losses, p: stats.pushes },
        winPct: stats.winPct,
        units: stats.units,
        roi: stats.roi,
        streak,
        recentForm,
        trophies: [],
        settledPicks: stats.settled,
        verifiedShare: computeVerifiedShare(
          playRows.map((x) => x.verificationTier),
        ),
        avgClv,
        stakedUnits: stats.stakedUnits,
        performanceTrend,
        lastPlayAt: positions.at(-1)?.createdAt,
        headline: p.headline ?? undefined,
        bio: p.bio ?? undefined,
        specialties: p.specialties.length ? p.specialties : undefined,
        sports: p.sports.length ? p.sports : undefined,
        books: p.books.length ? p.books : undefined,
        storefront: resolveStorefrontIdentity({
          username,
          title: p.storefrontTitle,
          description: p.storefrontDescription,
          enabled: p.storefrontEnabled,
        }),
        joinedAt: p.createdAt,
        isLegacy: p.isLegacy || undefined,
        activity: computeCapperActivity(positions.map((x) => x.createdAt)),
      };

      inputs.push({ summary, plays: playRows });
    }

    return { lanes: buildAllDiscoverLanes(inputs), failed: false };
  } catch (err) {
    console.error("[getDiscoverLanes] database unavailable:", err);
    return {
      lanes: buildAllDiscoverLanes([]),
      failed: true,
    };
  }
}
