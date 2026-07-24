import "server-only";

import type { Outcome, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type AdminPlayFilters = {
  outcome?: Outcome | "ALL";
  sport?: string;
  search?: string;
  limit?: number;
};

export async function getAdminPublishedPlays(filters: AdminPlayFilters = {}) {
  const where: Prisma.PlayWhereInput = { parlayId: null };

  if (filters.outcome && filters.outcome !== "ALL") {
    where.outcome = filters.outcome;
  }
  if (filters.sport?.trim()) {
    where.sport = filters.sport.trim().toUpperCase();
  }
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { selection: { contains: q, mode: "insensitive" } },
      { market: { contains: q, mode: "insensitive" } },
      {
        capper: {
          user: {
            OR: [
              { username: { contains: q, mode: "insensitive" } },
              { displayName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      },
    ];
  }

  const plays = await prisma.play.findMany({
    where,
    select: {
      id: true,
      sport: true,
      market: true,
      selection: true,
      oddsAmerican: true,
      units: true,
      outcome: true,
      createdAt: true,
      gradedAt: true,
      capper: {
        select: {
          user: { select: { username: true, displayName: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: filters.limit ?? 200,
  });

  return plays.map((play) => ({
    id: play.id,
    sport: play.sport,
    market: play.market,
    selection: play.selection,
    oddsAmerican: play.oddsAmerican,
    units: Number(play.units),
    outcome: play.outcome,
    createdAt: play.createdAt,
    gradedAt: play.gradedAt,
    capperName:
      play.capper.user.displayName ??
      (play.capper.user.username
        ? `@${play.capper.user.username.replace(/^@/, "")}`
        : "Unknown"),
  }));
}

export type AdminPublishedPlay = Awaited<
  ReturnType<typeof getAdminPublishedPlays>
>[number];
