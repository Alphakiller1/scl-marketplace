import "server-only";

import type { GradingSource, Outcome, VerificationTier } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  buildPublishedParlayWhere,
  buildPublishedStraightPlayWhere,
} from "@/lib/queries/published-play-where";

export type AdminSettlementAudit = {
  id: string;
  previousOutcome: Outcome;
  newOutcome: Outcome;
  previousProfitUnits: number | null;
  newProfitUnits: number | null;
  source: GradingSource;
  reason: string | null;
  gradedBy: string;
  createdAt: Date;
};

type AdminCorrectionBase = {
  id: string;
  username: string | null;
  capperName: string;
  units: number;
  outcome: Outcome;
  profitUnits: number | null;
  createdAt: Date;
  gradedAt: Date | null;
};

export type AdminStraightCorrectionRecord = AdminCorrectionBase & {
  kind: "straight";
  sport: string;
  market: string;
  selection: string;
  oddsAmerican: number;
  verificationTier: VerificationTier;
  eventStartsAt: Date | null;
  audits: AdminSettlementAudit[];
};

export type AdminParlayCorrectionRecord = AdminCorrectionBase & {
  kind: "parlay";
  combinedOddsAmerican: number | null;
  legs: {
    id: string;
    sport: string;
    market: string;
    selection: string;
    oddsAmerican: number;
    outcome: Outcome;
    audits: AdminSettlementAudit[];
  }[];
  audits: AdminSettlementAudit[];
};

export type AdminCorrectionRecord =
  AdminStraightCorrectionRecord | AdminParlayCorrectionRecord;

function actorLabel(
  actor: {
    username: string | null;
    displayName: string | null;
  } | null,
): string {
  if (actor?.username) return `@${actor.username.replace(/^@/, "")}`;
  return actor?.displayName || "System";
}

function normalizeAudit(audit: {
  id: string;
  previousOutcome: Outcome;
  newOutcome: Outcome;
  previousProfitUnits: { toString(): string } | null;
  newProfitUnits: { toString(): string } | null;
  source: GradingSource;
  reason: string | null;
  createdAt: Date;
  gradedBy: {
    username: string | null;
    displayName: string | null;
  } | null;
}): AdminSettlementAudit {
  return {
    id: audit.id,
    previousOutcome: audit.previousOutcome,
    newOutcome: audit.newOutcome,
    previousProfitUnits:
      audit.previousProfitUnits == null
        ? null
        : Number(audit.previousProfitUnits),
    newProfitUnits:
      audit.newProfitUnits == null ? null : Number(audit.newProfitUnits),
    source: audit.source,
    reason: audit.reason,
    gradedBy: actorLabel(audit.gradedBy),
    createdAt: audit.createdAt,
  };
}

export async function getAdminStraightCorrectionRecord(
  id: string,
): Promise<AdminStraightCorrectionRecord | null> {
  const publicationWhere = await buildPublishedStraightPlayWhere();
  const play = await prisma.play.findFirst({
    where: { AND: [publicationWhere, { id }] },
    select: {
      id: true,
      sport: true,
      market: true,
      selection: true,
      oddsAmerican: true,
      units: true,
      outcome: true,
      profitUnits: true,
      verificationTier: true,
      eventStartsAt: true,
      createdAt: true,
      gradedAt: true,
      capper: {
        select: {
          user: {
            select: {
              username: true,
              displayName: true,
            },
          },
        },
      },
      audits: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          previousOutcome: true,
          newOutcome: true,
          previousProfitUnits: true,
          newProfitUnits: true,
          source: true,
          reason: true,
          createdAt: true,
          gradedBy: {
            select: {
              username: true,
              displayName: true,
            },
          },
        },
      },
    },
  });
  if (!play) return null;

  return {
    kind: "straight",
    id: play.id,
    username: play.capper.user.username,
    capperName:
      play.capper.user.displayName ||
      (play.capper.user.username
        ? `@${play.capper.user.username.replace(/^@/, "")}`
        : "Unavailable capper"),
    sport: play.sport,
    market: play.market,
    selection: play.selection,
    oddsAmerican: play.oddsAmerican,
    units: Number(play.units),
    outcome: play.outcome,
    profitUnits: play.profitUnits == null ? null : Number(play.profitUnits),
    verificationTier: play.verificationTier,
    eventStartsAt: play.eventStartsAt,
    createdAt: play.createdAt,
    gradedAt: play.gradedAt,
    audits: play.audits.map(normalizeAudit),
  };
}

export async function getAdminParlayCorrectionRecord(
  id: string,
): Promise<AdminParlayCorrectionRecord | null> {
  const publicationWhere = await buildPublishedParlayWhere();
  const parlay = await prisma.parlay.findFirst({
    where: { AND: [publicationWhere, { id }] },
    select: {
      id: true,
      combinedOddsAmerican: true,
      units: true,
      outcome: true,
      profitUnits: true,
      createdAt: true,
      gradedAt: true,
      capper: {
        select: {
          user: {
            select: {
              username: true,
              displayName: true,
            },
          },
        },
      },
      legs: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          sport: true,
          market: true,
          selection: true,
          oddsAmerican: true,
          outcome: true,
          audits: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              previousOutcome: true,
              newOutcome: true,
              previousProfitUnits: true,
              newProfitUnits: true,
              source: true,
              reason: true,
              createdAt: true,
              gradedBy: {
                select: {
                  username: true,
                  displayName: true,
                },
              },
            },
          },
        },
      },
      audits: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          previousOutcome: true,
          newOutcome: true,
          previousProfitUnits: true,
          newProfitUnits: true,
          source: true,
          reason: true,
          createdAt: true,
          gradedBy: {
            select: {
              username: true,
              displayName: true,
            },
          },
        },
      },
    },
  });
  if (!parlay) return null;

  return {
    kind: "parlay",
    id: parlay.id,
    username: parlay.capper.user.username,
    capperName:
      parlay.capper.user.displayName ||
      (parlay.capper.user.username
        ? `@${parlay.capper.user.username.replace(/^@/, "")}`
        : "Unavailable capper"),
    combinedOddsAmerican: parlay.combinedOddsAmerican,
    units: Number(parlay.units),
    outcome: parlay.outcome,
    profitUnits: parlay.profitUnits == null ? null : Number(parlay.profitUnits),
    createdAt: parlay.createdAt,
    gradedAt: parlay.gradedAt,
    legs: parlay.legs.map((leg) => ({
      id: leg.id,
      sport: leg.sport,
      market: leg.market,
      selection: leg.selection,
      oddsAmerican: leg.oddsAmerican,
      outcome: leg.outcome,
      audits: leg.audits.map(normalizeAudit),
    })),
    audits: parlay.audits.map(normalizeAudit),
  };
}
