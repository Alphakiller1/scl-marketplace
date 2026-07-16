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

export type GradedWinsTickerResult = {
  wins: YesterdayGradedWin[];
  /** Eyebrow label — Yesterday when calendar-ET hits exist, else Recent. */
  label: "Yesterday's Graded Wins" | "Recent Graded Wins";
};

async function queryWins(whereGradedAt: {
  gte: Date;
  lt?: Date;
}): Promise<YesterdayGradedWin[]> {
  const plays = await prisma.play.findMany({
    where: {
      outcome: "WIN",
      parlayId: null,
      units: { gte: UNIT_MIN },
      gradedAt: whereGradedAt,
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
    take: 20,
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
}

/**
 * Public homepage ticker feed.
 * Prefer yesterday ET (Fable Step 8). If that window is empty during cold start,
 * fall back to graded wins from the last 7 days — still real past-tense results,
 * never fabricated. Hide the module when both windows are empty.
 */
export async function getYesterdaysGradedWins(): Promise<GradedWinsTickerResult> {
  try {
    const { start, end } = etDayBounds(-1);
    const yesterday = await queryWins({ gte: start, lt: end });
    if (yesterday.length > 0) {
      return { wins: yesterday, label: "Yesterday's Graded Wins" };
    }

    const weekAgo = new Date(Date.now() - 7 * 86_400_000);
    const recent = await queryWins({ gte: weekAgo });
    return {
      wins: recent,
      label: "Recent Graded Wins",
    };
  } catch (error) {
    console.error("[getYesterdaysGradedWins] database unavailable:", error);
    return { wins: [], label: "Yesterday's Graded Wins" };
  }
}
