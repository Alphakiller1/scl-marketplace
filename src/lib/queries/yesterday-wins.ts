import "server-only";

import type { Outcome } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { etDayBounds } from "@/lib/et-day";
import { UNIT_MIN } from "@/lib/constants";
import { prismaExcludeTestHandlesLive } from "@/lib/public-eligibility-prisma";

const GRADED: Outcome[] = ["WIN", "LOSS", "PUSH"];

export type GradedTickerResult = {
  id: string;
  handle: string;
  selection: string;
  units: number;
  /** Null when settlement P/L was not stored — never invent a return. */
  profitUnits: number | null;
  outcome: "WIN" | "LOSS" | "PUSH";
};

export type GradedResultsTickerPayload = {
  results: GradedTickerResult[];
  /** Eyebrow — Yesterday when calendar-ET hits exist, else Recent. */
  label: "Yesterday's graded results" | "Recent graded results";
};

/** @deprecated Prefer GradedTickerResult — kept for import compat during rename. */
export type YesterdayGradedWin = GradedTickerResult;

async function queryGradedResults(whereGradedAt: {
  gte: Date;
  lt?: Date;
}): Promise<GradedTickerResult[]> {
  const excludeTest = await prismaExcludeTestHandlesLive();
  const plays = await prisma.play.findMany({
    where: {
      outcome: { in: GRADED },
      parlayId: null,
      units: { gte: UNIT_MIN },
      gradedAt: whereGradedAt,
      capper: {
        user: {
          accountStatus: "ACTIVE",
          username: { not: null },
          ...excludeTest,
        },
      },
    },
    select: {
      id: true,
      selection: true,
      units: true,
      profitUnits: true,
      outcome: true,
      gradedAt: true,
      capper: {
        select: {
          user: { select: { username: true } },
        },
      },
    },
    orderBy: { gradedAt: "desc" },
    take: 24,
  });

  return plays.flatMap((p) => {
    const handle = p.capper.user.username;
    if (!handle) return [];
    if (p.outcome !== "WIN" && p.outcome !== "LOSS" && p.outcome !== "PUSH") {
      return [];
    }
    const profitRaw = p.profitUnits;
    return [
      {
        id: p.id,
        handle,
        selection: p.selection,
        units: Number(p.units),
        profitUnits: profitRaw == null ? null : Number(profitRaw),
        outcome: p.outcome,
      },
    ];
  });
}

/**
 * Public homepage ticker — previous ET day's graded results (W/L/P).
 * Falls back to the last 7 days when yesterday is empty. Never fabricate.
 * Hide the module when both windows are empty.
 */
export async function getYesterdaysGradedWins(): Promise<GradedResultsTickerPayload> {
  try {
    const { start, end } = etDayBounds(-1);
    const yesterday = await queryGradedResults({ gte: start, lt: end });
    if (yesterday.length > 0) {
      return {
        results: yesterday,
        label: "Yesterday's graded results",
      };
    }

    const weekAgo = new Date(Date.now() - 7 * 86_400_000);
    const recent = await queryGradedResults({ gte: weekAgo });
    return {
      results: recent,
      label: "Recent graded results",
    };
  } catch (error) {
    console.error("[getYesterdaysGradedWins] database unavailable:", error);
    return { results: [], label: "Yesterday's graded results" };
  }
}
