import "server-only";

import type { Outcome } from "@prisma/client";

import {
  americanToDecimal,
  combineDecimalOdds,
  decimalToAmerican,
} from "@/lib/odds";
import { prisma } from "@/lib/prisma";
import type { CapperSummary, TodayPick } from "@/lib/mock";

export type PlayView = {
  id: string;
  kind: "straight" | "parlay";
  sport: string;
  league: string | null;
  market: string;
  selection: string;
  oddsAmerican: number;
  units: number;
  outcome: Outcome;
  profitUnits: number | null;
  createdAt: Date;
  legs?: {
    id: string;
    sport: string;
    league: string | null;
    market: string;
    selection: string;
    oddsAmerican: number;
    outcome: Outcome;
  }[];
};

type StraightPlayRow = {
  id: string;
  sport: string;
  league: string | null;
  market: string;
  selection: string;
  oddsAmerican: number;
  units: unknown;
  outcome: Outcome;
  profitUnits: unknown | null;
  createdAt: Date;
};

type ParlayLegRow = {
  id: string;
  sport: string;
  league: string | null;
  market: string;
  selection: string;
  oddsAmerican: number;
  outcome: Outcome;
};

type ParlayRow = {
  id: string;
  combinedOddsAmerican: number | null;
  units: unknown;
  outcome: Outcome;
  profitUnits: unknown | null;
  createdAt: Date;
  legs: ParlayLegRow[];
};

type PublicStraightPlayRow = StraightPlayRow & { capperId: string };
type PublicParlayRow = ParlayRow & { capperId: string };

function sortRecent<T extends { createdAt: Date }>(items: T[]): T[] {
  return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function parlaySport(legs: ParlayLegRow[]): string {
  const sports = [...new Set(legs.map((leg) => leg.sport))];
  return sports.length === 1 ? sports[0] : "PARLAY";
}

function parlayOdds(parlay: ParlayRow): number {
  if (parlay.combinedOddsAmerican != null) return parlay.combinedOddsAmerican;
  return decimalToAmerican(
    combineDecimalOdds(
      parlay.legs.map((leg) => americanToDecimal(leg.oddsAmerican)),
    ),
  );
}

function toStraightPlayView(play: StraightPlayRow): PlayView {
  return {
    id: play.id,
    kind: "straight",
    sport: play.sport,
    league: play.league,
    market: play.market,
    selection: play.selection,
    oddsAmerican: play.oddsAmerican,
    units: Number(play.units),
    outcome: play.outcome,
    profitUnits: play.profitUnits == null ? null : Number(play.profitUnits),
    createdAt: play.createdAt,
  };
}

function toParlayView(parlay: ParlayRow): PlayView {
  return {
    id: parlay.id,
    kind: "parlay",
    sport: parlaySport(parlay.legs),
    league: null,
    market: "Parlay",
    selection: `${parlay.legs.length}-Leg Parlay`,
    oddsAmerican: parlayOdds(parlay),
    units: Number(parlay.units),
    outcome: parlay.outcome,
    profitUnits: parlay.profitUnits == null ? null : Number(parlay.profitUnits),
    createdAt: parlay.createdAt,
    legs: parlay.legs,
  };
}

/** A capper's tracked positions (most recent first), with Decimals serialized to numbers. */
export async function getCapperPlays(
  userId: string,
  take?: number,
): Promise<PlayView[]> {
  const profile = await prisma.capperProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) return [];

  const [plays, parlays] = await Promise.all([
    prisma.play.findMany({
      // Exclude parlay legs; the parlay is the position of record, not each leg.
      where: { capperId: profile.id, parlayId: null },
      orderBy: { createdAt: "desc" },
      take,
    }),
    prisma.parlay.findMany({
      where: { capperId: profile.id },
      include: {
        legs: {
          select: {
            id: true,
            sport: true,
            league: true,
            market: true,
            selection: true,
            oddsAmerican: true,
            outcome: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take,
    }),
  ]);

  const positions = sortRecent([
    ...plays.map(toStraightPlayView),
    ...parlays.map(toParlayView),
  ]);

  return take ? positions.slice(0, take) : positions;
}

/** Public profile positions by handle, using the same parlay-parent rules. */
export async function getCapperPlaysByHandle(
  handle: string,
  take = 8,
): Promise<PlayView[]> {
  const profile = await prisma.capperProfile.findFirst({
    where: { user: { username: handle } },
    select: { id: true },
  });
  if (!profile) return [];

  const [plays, parlays] = await Promise.all([
    prisma.play.findMany({
      where: { capperId: profile.id, parlayId: null },
      orderBy: { createdAt: "desc" },
      take,
    }),
    prisma.parlay.findMany({
      where: { capperId: profile.id },
      include: {
        legs: {
          select: {
            id: true,
            sport: true,
            league: true,
            market: true,
            selection: true,
            oddsAmerican: true,
            outcome: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take,
    }),
  ]);

  return sortRecent([
    ...plays.map(toStraightPlayView),
    ...parlays.map(toParlayView),
  ]).slice(0, take);
}

const OUTCOME_TO_PICK_STATUS = {
  PENDING: "pending",
  WIN: "win",
  LOSS: "loss",
  PUSH: "push",
  VOID: "void",
} as const satisfies Record<Outcome, TodayPick["status"]>;

function toTodayPick(play: PlayView, capper: CapperSummary): TodayPick {
  return {
    id: play.id,
    capper: {
      id: capper.id,
      name: capper.name,
      handle: capper.handle,
      verified: capper.verified,
      avatarUrl: capper.avatarUrl,
    },
    capperRecord: capper.record,
    sport: play.sport,
    event: play.league ?? play.market,
    selection: play.selection,
    oddsAmerican: play.oddsAmerican,
    units: play.units,
    status: OUTCOME_TO_PICK_STATUS[play.outcome],
    postedAt: play.createdAt,
    gameTime: play.outcome === "PENDING" ? "Pending" : "Graded",
  };
}

/**
 * Latest public positions from active cappers. Parlay legs are hidden here because
 * the parlay parent is the tracked position of record.
 */
export async function getPublicRecentPicks(
  cappers: CapperSummary[],
  take = 8,
): Promise<TodayPick[]> {
  return (await getPublicRecentPicksResult(cappers, take)).picks;
}

export async function getPublicRecentPicksResult(
  cappers: CapperSummary[],
  take = 8,
): Promise<{ picks: TodayPick[]; failed: boolean }> {
  const capperById = new Map(cappers.map((capper) => [capper.id, capper]));

  try {
    const [plays, parlays] = await Promise.all([
      prisma.play.findMany({
        where: {
          parlayId: null,
          capper: {
            user: {
              accountStatus: "ACTIVE",
              username: { not: null },
            },
          },
        },
        select: {
          id: true,
          capperId: true,
          sport: true,
          league: true,
          market: true,
          selection: true,
          oddsAmerican: true,
          units: true,
          outcome: true,
          profitUnits: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take,
      }),
      prisma.parlay.findMany({
        where: {
          capper: {
            user: {
              accountStatus: "ACTIVE",
              username: { not: null },
            },
          },
        },
        select: {
          id: true,
          capperId: true,
          combinedOddsAmerican: true,
          units: true,
          outcome: true,
          profitUnits: true,
          createdAt: true,
          legs: {
            select: {
              id: true,
              sport: true,
              league: true,
              market: true,
              selection: true,
              oddsAmerican: true,
              outcome: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
        take,
      }),
    ]);

    const straightPicks = plays.flatMap((play: PublicStraightPlayRow) => {
      const capper = capperById.get(play.capperId);
      return capper ? [toTodayPick(toStraightPlayView(play), capper)] : [];
    });
    const parlayPicks = parlays.flatMap((parlay: PublicParlayRow) => {
      const capper = capperById.get(parlay.capperId);
      return capper ? [toTodayPick(toParlayView(parlay), capper)] : [];
    });

    const picks = [...straightPicks, ...parlayPicks]
      .sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime())
      .slice(0, take);
    return { picks, failed: false };
  } catch (error) {
    console.error("[getPublicRecentPicks] database unavailable:", error);
    return { picks: [], failed: true };
  }
}
