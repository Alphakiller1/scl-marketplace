import "server-only";

import type { PackageEvidence } from "@/lib/package-register";
import { summarizePackagePositions } from "@/lib/package-performance";
import { withTransientDatabaseRetry } from "@/lib/database-retry";
import {
  buildProfileChartSeries,
  type ProfileChartSeries,
} from "@/lib/profile-chart-window";
import { prisma } from "@/lib/prisma";
import { hasQaNoteMarker, isValidPublicStake } from "@/lib/public-eligibility";
import { stakeFromStored } from "@/lib/extreme-stake";

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
    const packages = await withTransientDatabaseRetry(
      () =>
        prisma.package.findMany({
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
                  select: {
                    outcome: true,
                    units: true,
                    profitUnits: true,
                    createdAt: true,
                    // A parlay has no sport column; the sport filter attributes
                    // it to leg one, as every other surface does.
                    legs: {
                      select: { sport: true },
                      orderBy: { createdAt: "asc" as const },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        }),
      { label: "package performance evidence" },
    );

    const now = new Date();
    const evidence: Record<string, PackageEvidence | null> = {};
    const profiles: Record<string, PackagePerformanceProfile> = {};

    for (const pkg of packages) {
      const plays = pkg.playLinks
        .map(({ play }) => {
          const stake = stakeFromStored(play.units, play.profitUnits);
          return {
            ...play,
            units: stake.units,
            profitUnits: stake.profitUnits,
          };
        })
        .filter(
          (play) =>
            isValidPublicStake(play.units) && !hasQaNoteMarker(play.notes),
        );
      const parlays = pkg.parlayLinks.map(({ parlay }) => {
        const stake = stakeFromStored(parlay.units, parlay.profitUnits);
        return {
          ...parlay,
          units: stake.units,
          profitUnits: stake.profitUnits,
        };
      });
      evidence[pkg.id] = summarizePackagePositions([...plays, ...parlays]);

      // The chart plots the same positions the headline evidence counts. Before
      // this it plotted straight picks only, so a package sold on parlays
      // showed a record its curve never explained.
      const positions = [
        ...plays.map((play) => ({
          createdAt: play.createdAt,
          outcome: play.outcome,
          units: play.units,
          profitUnits: play.profitUnits,
          sport: play.sport,
        })),
        ...parlays.map((parlay) => ({
          createdAt: parlay.createdAt,
          outcome: parlay.outcome,
          units: parlay.units,
          profitUnits: parlay.profitUnits,
          sport: parlay.legs[0]?.sport ?? "MULTI",
        })),
      ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const sports = [
        ...new Set(positions.map((position) => position.sport)),
      ].sort();
      profiles[pkg.id] = {
        chartSeries: buildProfileChartSeries(positions, now),
        chartSeriesBySport: Object.fromEntries(
          sports.map((sport) => [
            sport,
            buildProfileChartSeries(
              positions.filter((position) => position.sport === sport),
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
