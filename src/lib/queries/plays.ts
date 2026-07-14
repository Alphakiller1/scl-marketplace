import "server-only";

import type { Outcome } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { CapperSummary, TodayPick } from "@/lib/mock";
import { joinPlaysToPublicPicks } from "@/lib/public-picks";
import { isVerifiedTier, type VerificationTier } from "@/lib/verification";

export type PlayView = {
  id: string;
  sport: string;
  league: string | null;
  market: string;
  selection: string;
  oddsAmerican: number;
  units: number;
  outcome: Outcome;
  profitUnits: number | null;
  createdAt: Date;
  verificationTier: VerificationTier;
  /** Structured board side when present — never invent from free-text selection. */
  side: string | null;
};

export type ParlayLegView = {
  id: string;
  sport: string;
  market: string;
  selection: string;
  oddsAmerican: number;
  side: string | null;
};

/** A capper's parlay as a single position of record, with its legs. */
export type ParlayView = {
  id: string;
  combinedOddsAmerican: number | null;
  units: number;
  outcome: Outcome;
  profitUnits: number | null;
  createdAt: Date;
  /** Verified only when every leg was logged pre-game and price-verified. */
  verificationTier: VerificationTier;
  legs: ParlayLegView[];
};

/** A record entry is either a straight play or a parlay; both share a createdAt for ordering. */
export type RecordEntry =
  | ({ kind: "play" } & PlayView)
  | ({ kind: "parlay" } & ParlayView);

/** Merge plays + parlays into one most-recent-first record list (pure; no DB). */
export function mergeRecordEntries(
  plays: PlayView[],
  parlays: ParlayView[],
): RecordEntry[] {
  const entries: RecordEntry[] = [
    ...plays.map((p) => ({ kind: "play" as const, ...p })),
    ...parlays.map((p) => ({ kind: "parlay" as const, ...p })),
  ];
  return entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** A capper's plays (most recent first), with Decimals serialized to numbers. */
export async function getCapperPlays(
  userId: string,
  take?: number,
): Promise<PlayView[]> {
  const profile = await prisma.capperProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) return [];

  const plays = await prisma.play.findMany({
    // Exclude parlay legs — the parlay is the position of record, not each leg.
    where: { capperId: profile.id, parlayId: null },
    orderBy: { createdAt: "desc" },
    take,
  });

  return plays.map((p) => ({
    id: p.id,
    sport: p.sport,
    league: p.league,
    market: p.market,
    selection: p.selection,
    oddsAmerican: p.oddsAmerican,
    units: Number(p.units),
    outcome: p.outcome,
    profitUnits: p.profitUnits == null ? null : Number(p.profitUnits),
    createdAt: p.createdAt,
    verificationTier: p.verificationTier,
    side: p.side,
  }));
}

/** A capper's parlays (most recent first) with their legs — the parlay is the position. */
export async function getCapperParlays(
  userId: string,
  take?: number,
): Promise<ParlayView[]> {
  const profile = await prisma.capperProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) return [];

  const parlays = await prisma.parlay.findMany({
    where: { capperId: profile.id },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      legs: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          sport: true,
          market: true,
          selection: true,
          oddsAmerican: true,
          side: true,
          verificationTier: true,
        },
      },
    },
  });

  return parlays.map((p) => ({
    id: p.id,
    combinedOddsAmerican: p.combinedOddsAmerican,
    units: Number(p.units),
    outcome: p.outcome,
    profitUnits: p.profitUnits == null ? null : Number(p.profitUnits),
    createdAt: p.createdAt,
    verificationTier:
      p.legs.length > 0 &&
      p.legs.every((l) => isVerifiedTier(l.verificationTier))
        ? "VERIFIED"
        : "SELF_REPORTED",
    legs: p.legs.map((l) => ({
      id: l.id,
      sport: l.sport,
      market: l.market,
      selection: l.selection,
      oddsAmerican: l.oddsAmerican,
      side: l.side,
    })),
  }));
}

/**
 * Latest public plays from active cappers. The available Phase 1 schema does
 * not store event start time, so the UI labels these as pending or graded
 * rather than inventing a game time.
 *
 * Pass ranked.concat(unranked) from getLeaderboardResult so Building-a-Record
 * cappers' verified plays surface; ranking itself stays on the leaderboard.
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
  try {
    const plays = await prisma.play.findMany({
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
        sport: true,
        league: true,
        market: true,
        selection: true,
        oddsAmerican: true,
        units: true,
        outcome: true,
        profitUnits: true,
        createdAt: true,
        verificationTier: true,
        side: true,
      },
      orderBy: { createdAt: "desc" },
      take,
    });

    return { picks: joinPlaysToPublicPicks(plays, cappers), failed: false };
  } catch (error) {
    console.error("[getPublicRecentPicks] database unavailable:", error);
    return { picks: [], failed: true };
  }
}
