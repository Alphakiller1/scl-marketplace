import "server-only";

import type { PackageEvidence } from "@/lib/package-register";
import { summarizePackagePositions } from "@/lib/package-performance";
import { prisma } from "@/lib/prisma";

export async function getPackagePerformanceEvidence(
  packageIds: string[],
): Promise<{
  evidence: Record<string, PackageEvidence | null>;
  failed: boolean;
}> {
  if (packageIds.length === 0) return { evidence: {}, failed: false };
  try {
    const packages = await prisma.package.findMany({
      where: { id: { in: packageIds } },
      select: {
        id: true,
        playLinks: {
          where: { play: { parlayId: null } },
          select: {
            play: {
              select: { outcome: true, units: true, profitUnits: true },
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

    return {
      evidence: Object.fromEntries(
        packages.map((pkg) => [
          pkg.id,
          summarizePackagePositions([
            ...pkg.playLinks.map(({ play }) => ({
              ...play,
              units: Number(play.units),
              profitUnits:
                play.profitUnits == null ? null : Number(play.profitUnits),
            })),
            ...pkg.parlayLinks.map(({ parlay }) => ({
              ...parlay,
              units: Number(parlay.units),
              profitUnits:
                parlay.profitUnits == null ? null : Number(parlay.profitUnits),
            })),
          ]),
        ]),
      ),
      failed: false,
    };
  } catch (error) {
    console.error("[getPackagePerformanceEvidence] unavailable:", error);
    return { evidence: {}, failed: true };
  }
}
