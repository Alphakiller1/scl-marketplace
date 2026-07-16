import "server-only";

import { prisma } from "@/lib/prisma";
import { etDayBounds } from "@/lib/et-day";
import { UNIT_MIN } from "@/lib/constants";
import { prismaExcludeTestHandles } from "@/lib/public-eligibility";

export type YesterdayGradedWin = {
  id: string;
  handle: string;
  selection: string;
  units: number;
  profitUnits: number;
};

export async function getYesterdaysGradedWins(
  take = 20,
): Promise<YesterdayGradedWin[]> {
  const { start, end } = etDayBounds(-1);

  try {
    const plays = await prisma.play.findMany({
      where: {
        outcome: "WIN",
        parlayId: null,
        units: { gte: UNIT_MIN },
        gradedAt: { gte: start, lt: end },
        capper: {
          user: {
            accountStatus: "ACTIVE",
            username: { not: null },
            ...prismaExcludeTestHandles(),
          },
        },
      },
      select: {
        id: true,
        selection: true,
        units: true,
        profitUnits: true,
        capper: {
          select: {
            user: { select: { username: true } },
          },
        },
      },
      orderBy: { profitUnits: "desc" },
      take,
    });

    return plays.flatMap((p) => {
      const handle = p.capper.user.username;
      if (!handle) return [];
      return [
        {
          id: p.id,
          handle,
          selection: p.selection,
          units: Number(p.units),
          profitUnits: Number(p.profitUnits ?? 0),
        },
      ];
    });
  } catch (error) {
    console.error("[getYesterdaysGradedWins] database unavailable:", error);
    return [];
  }
}
