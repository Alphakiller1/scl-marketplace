import "server-only";

import type { Prisma } from "@prisma/client";

import { UNIT_MIN } from "@/lib/constants";
import { PUBLIC_QA_NOTE_PHRASES } from "@/lib/public-eligibility";
import { prismaExcludeTestHandlesLive } from "@/lib/public-eligibility-prisma";

/**
 * One publication contract for the public ledger and the admin register.
 * Parlays are positions of record, so individual legs are not standalone plays.
 */
export async function buildPublishedStraightPlayWhere(): Promise<Prisma.PlayWhereInput> {
  const excludeTest = await prismaExcludeTestHandlesLive();

  return {
    status: "COMMITTED",
    parlayId: null,
    units: { gte: UNIT_MIN },
    AND: PUBLIC_QA_NOTE_PHRASES.map((phrase) => ({
      OR: [
        { notes: null },
        {
          NOT: {
            notes: { contains: phrase, mode: "insensitive" },
          },
        },
      ],
    })),
    capper: {
      user: {
        accountStatus: "ACTIVE",
        username: { not: null },
        ...excludeTest,
      },
    },
  };
}

export async function buildPublishedParlayWhere(): Promise<Prisma.ParlayWhereInput> {
  const excludeTest = await prismaExcludeTestHandlesLive();

  return {
    units: { gte: UNIT_MIN },
    legs: {
      some: {},
      every: { status: "COMMITTED" },
    },
    capper: {
      user: {
        accountStatus: "ACTIVE",
        username: { not: null },
        ...excludeTest,
      },
    },
  };
}
