import "server-only";

import type { Outcome, Prisma, VerificationTier } from "@prisma/client";

import {
  ADMIN_PLAYS_PAGE_SIZE,
  type AdminPublishedPlayFilters,
} from "@/lib/admin-published-plays";
import { hasQaNoteMarker } from "@/lib/public-eligibility";
import { prisma } from "@/lib/prisma";
import {
  buildPublishedParlayWhere,
  buildPublishedStraightPlayWhere,
} from "@/lib/queries/published-play-where";
import { hasNotesPublicColumn } from "@/lib/results/schema-features";
import { isVerifiedTier } from "@/lib/verification";

export type AdminPublishedRecord = {
  kind: "straight" | "parlay";
  id: string;
  sports: string[];
  market: string;
  selection: string;
  oddsAmerican: number | null;
  units: number;
  outcome: Outcome;
  createdAt: Date;
  eventStartsAt: Date | null;
  verificationTier: VerificationTier;
  notes: string | null;
  notesPublic: boolean;
  username: string | null;
};

function outcomeWhere(
  status: AdminPublishedPlayFilters["status"],
): Outcome[] | null {
  return status === "pending"
    ? ["PENDING"]
    : status === "graded"
      ? ["WIN", "LOSS", "PUSH", "VOID"]
      : null;
}

function pageDetails(total: number, requestedPage: number) {
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PLAYS_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  return { page, totalPages };
}

function earliestStart(legs: { eventStartsAt: Date | null }[]): Date | null {
  const starts = legs
    .map((leg) => leg.eventStartsAt)
    .filter((value): value is Date => value != null);
  if (!starts.length) return null;
  return starts.reduce((earliest, value) =>
    value.getTime() < earliest.getTime() ? value : earliest,
  );
}

async function getStraightPlays(filters: AdminPublishedPlayFilters) {
  const [publicationWhere, notesPublicReady] = await Promise.all([
    buildPublishedStraightPlayWhere(),
    hasNotesPublicColumn(),
  ]);
  const outcome = outcomeWhere(filters.status);
  const filterWhere: Prisma.PlayWhereInput = {
    ...(filters.sport !== "all" ? { sport: filters.sport } : {}),
    ...(outcome ? { outcome: { in: outcome } } : {}),
    ...(filters.search
      ? {
          OR: [
            {
              selection: {
                contains: filters.search,
                mode: "insensitive",
              },
            },
            {
              market: {
                contains: filters.search,
                mode: "insensitive",
              },
            },
            {
              capper: {
                user: {
                  username: {
                    contains: filters.search.replace(/^@/, ""),
                    mode: "insensitive",
                  },
                },
              },
            },
          ],
        }
      : {}),
  };
  const where: Prisma.PlayWhereInput = {
    AND: [publicationWhere, filterWhere],
  };
  const total = await prisma.play.count({ where });
  const { page, totalPages } = pageDetails(total, filters.page);
  const rows = await prisma.play.findMany({
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
      eventStartsAt: true,
      verificationTier: true,
      notes: true,
      ...(notesPublicReady ? { notesPublic: true } : {}),
      capper: {
        select: {
          user: {
            select: { username: true },
          },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * ADMIN_PLAYS_PAGE_SIZE,
    take: ADMIN_PLAYS_PAGE_SIZE,
  });

  const records: AdminPublishedRecord[] = rows
    .filter((row) => !hasQaNoteMarker(row.notes))
    .map((row) => ({
      kind: "straight",
      id: row.id,
      sports: [row.sport],
      market: row.market,
      selection: row.selection,
      oddsAmerican: row.oddsAmerican,
      units: Number(row.units),
      outcome: row.outcome,
      createdAt: row.createdAt,
      eventStartsAt: row.eventStartsAt,
      verificationTier: row.verificationTier,
      notes: row.notes,
      notesPublic:
        "notesPublic" in row
          ? ((row as { notesPublic?: boolean }).notesPublic ?? true)
          : true,
      username: row.capper.user.username,
    }));

  return { rows: records, total, page, totalPages };
}

async function getParlays(filters: AdminPublishedPlayFilters) {
  const publicationWhere = await buildPublishedParlayWhere();
  const outcome = outcomeWhere(filters.status);
  const filterWhere: Prisma.ParlayWhereInput = {
    ...(outcome ? { outcome: { in: outcome } } : {}),
    ...(filters.sport !== "all"
      ? { legs: { some: { sport: filters.sport } } }
      : {}),
    ...(filters.search
      ? {
          OR: [
            {
              legs: {
                some: {
                  selection: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
              },
            },
            {
              legs: {
                some: {
                  market: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
              },
            },
            {
              capper: {
                user: {
                  username: {
                    contains: filters.search.replace(/^@/, ""),
                    mode: "insensitive",
                  },
                },
              },
            },
          ],
        }
      : {}),
  };
  const where: Prisma.ParlayWhereInput = {
    AND: [publicationWhere, filterWhere],
  };
  const total = await prisma.parlay.count({ where });
  const { page, totalPages } = pageDetails(total, filters.page);
  const rows = await prisma.parlay.findMany({
    where,
    select: {
      id: true,
      combinedOddsAmerican: true,
      units: true,
      outcome: true,
      createdAt: true,
      legs: {
        orderBy: { createdAt: "asc" },
        select: {
          sport: true,
          market: true,
          selection: true,
          eventStartsAt: true,
          verificationTier: true,
        },
      },
      capper: {
        select: {
          user: {
            select: { username: true },
          },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * ADMIN_PLAYS_PAGE_SIZE,
    take: ADMIN_PLAYS_PAGE_SIZE,
  });

  const records: AdminPublishedRecord[] = rows.map((row) => {
    const sports = [...new Set(row.legs.map((leg) => leg.sport))];
    const selections = row.legs.map((leg) => leg.selection);
    const selection =
      selections.length <= 2
        ? selections.join(" + ")
        : `${selections.slice(0, 2).join(" + ")} +${selections.length - 2} more`;

    return {
      kind: "parlay",
      id: row.id,
      sports,
      market: `${row.legs.length}-leg parlay`,
      selection,
      oddsAmerican: row.combinedOddsAmerican,
      units: Number(row.units),
      outcome: row.outcome,
      createdAt: row.createdAt,
      eventStartsAt: earliestStart(row.legs),
      verificationTier:
        row.legs.length > 0 &&
        row.legs.every((leg) => isVerifiedTier(leg.verificationTier))
          ? "VERIFIED"
          : "SELF_REPORTED",
      notes: null,
      notesPublic: false,
      username: row.capper.user.username,
    };
  });

  return { rows: records, total, page, totalPages };
}

export async function getAdminPublishedPlays(
  filters: AdminPublishedPlayFilters,
) {
  return filters.recordType === "parlay"
    ? getParlays(filters)
    : getStraightPlays(filters);
}
