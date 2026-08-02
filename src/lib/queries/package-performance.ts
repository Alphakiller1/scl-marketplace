import "server-only";

import type { PackageEvidence } from "@/lib/package-register";
import { summarizePackagePositions } from "@/lib/package-performance";
import {
  buildProfileChartSeries,
  type ProfileChartSeries,
} from "@/lib/profile-chart-window";
import { prisma } from "@/lib/prisma";
import { hasQaNoteMarker, isValidPublicStake } from "@/lib/public-eligibility";

export type PackagePerformanceProfile = {
  chartSeries: ProfileChartSeries;
  chartSeriesBySport: Record<string, ProfileChartSeries>;
  sports: string[];
};

export async function getPackagePerformanceEvidence(
  packageIds: string[],
): Promise<{
  evidence: Record<string, PackageEvidence | null>;
  profiles: Record<string, PackagePerformanceProfile>;
  failed: boolean;
}> {
  if (packageIds.length === 0) {
    return { evidence: {}, profiles: {}, failed: false };
  }
  try {
    const packages = await prisma.package.findMany({
      where: { id: { in: packageIds } },
      select: {
        id: true,
        playLinks: {
          where: { play: { parlayId: null } },
          select: {
            play: {
              select: {
                outcome: true,
                units: true,
                profitUnits: true,
                createdAt: true,
                sport: true,
                notes: true,
              },
            },
          },
        },
        parlayLinks: {
          select: {
            parlay: {
              select: { outcome: true, units: true, profitUnits: true },
            },
          },
        },
      },
    });

    const now = new Date();
    const evidence: Record<string, PackageEvidence | null> = {};
    const profiles: Record<string, PackagePerformanceProfile> = {};

    for (const pkg of packages) {
      const plays = pkg.playLinks
        .map(({ play }) => ({
          ...play,
          units: Number(play.units),
          profitUnits:
            play.profitUnits == null ? null : Number(play.profitUnits),
        }))
        .filter(
          (play) =>
            isValidPublicStake(play.units) && !hasQaNoteMarker(play.notes),
        );
      const parlays = pkg.parlayLinks.map(({ parlay }) => ({
        ...parlay,
        units: Number(parlay.units),
        profitUnits:
          parlay.profitUnits == null ? null : Number(parlay.profitUnits),
      }));
      evidence[pkg.id] = summarizePackagePositions([...plays, ...parlays]);

      const sports = [...new Set(plays.map((play) => play.sport))].sort();
      profiles[pkg.id] = {
        chartSeries: buildProfileChartSeries(plays, now),
        chartSeriesBySport: Object.fromEntries(
          sports.map((sport) => [
            sport,
            buildProfileChartSeries(
              plays.filter((play) => play.sport === sport),
              now,
            ),
          ]),
        ),
        sports,
      };
    }

    return { evidence, profiles, failed: false };
  } catch (error) {
    console.error("[getPackagePerformanceEvidence] unavailable:", error);
    return { evidence: {}, profiles: {}, failed: true };
  }
}
