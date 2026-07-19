import "server-only";

import type { Outcome } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { CapperSummary, TodayPick } from "@/lib/mock";
import { UNIT_MIN } from "@/lib/constants";
import { joinPlaysToPublicPicks } from "@/lib/public-picks";
import {
  DEFAULT_PUBLIC_PICKS_FILTERS,
  type PublicPicksLedgerFilters,
} from "@/lib/public-picks-ledger";
import { buildPublicPicksScopeWhere } from "@/lib/public-picks-scope";
import { hasQaNoteMarker } from "@/lib/public-eligibility";
import { prismaExcludeTestHandlesLive } from "@/lib/public-eligibility-prisma";
import { hasNotesPublicColumn } from "@/lib/results/schema-features";
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
  /** Scheduled event start (C2) — drives the pre-game/live/awaiting-grade lifecycle. */
  eventStartsAt: Date | null;
  /** Odds API bookmaker key at capture (M5 §4 source surfacing). */
  book: string | null;
  notes: string | null;
  notesPublic?: boolean;
  /** Closing American odds when snapshot exists — null → em-dash on Proof Receipt. */
  closingOddsAmerican?: number | null;
  /** CLV pts when computed — null → em-dash. */
  clvPts?: number | null;
};

export type ParlayLegView = {
  id: string;
  sport: string;
  market: string;
  selection: string;
  oddsAmerican: number;
  side: string | null;
  book: string | null;
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
  /** Earliest leg start — drives the parlay's lifecycle chip. */
  eventStartsAt: Date | null;
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

  const notesPublicReady = await hasNotesPublicColumn();
  const plays = await prisma.play.findMany({
    // Exclude parlay legs — the parlay is the position of record, not each leg.
    where: { capperId: profile.id, parlayId: null },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
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
      eventStartsAt: true,
      book: true,
      notes: true,
      ...(notesPublicReady ? { notesPublic: true } : {}),
    },
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
    eventStartsAt: p.eventStartsAt,
    book: p.book,
    notes: p.notes,
    notesPublic:
      "notesPublic" in p
        ? ((p as { notesPublic?: boolean }).notesPublic ?? true)
        : true,
  }));
}

/** Earliest leg start (or null) — the parlay's lifecycle anchors to its first game. */
function earliestStart(legs: { eventStartsAt: Date | null }[]): Date | null {
  const times = legs
    .map((l) => l.eventStartsAt)
    .filter((d): d is Date => d != null);
  if (times.length === 0) return null;
  return times.reduce((a, b) => (a.getTime() <= b.getTime() ? a : b));
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
          eventStartsAt: true,
          book: true,
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
    eventStartsAt: earliestStart(p.legs),
    legs: p.legs.map((l) => ({
      id: l.id,
      sport: l.sport,
      market: l.market,
      selection: l.selection,
      oddsAmerican: l.oddsAmerican,
      side: l.side,
      book: l.book,
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
  filters: PublicPicksLedgerFilters = DEFAULT_PUBLIC_PICKS_FILTERS,
  now: Date = new Date(),
): Promise<TodayPick[]> {
  return (await getPublicRecentPicksResult(cappers, take, filters, now)).picks;
}

export async function getPublicRecentPicksResult(
  cappers: CapperSummary[],
  take = 8,
  filters: PublicPicksLedgerFilters = DEFAULT_PUBLIC_PICKS_FILTERS,
  now: Date = new Date(),
): Promise<{ picks: TodayPick[]; failed: boolean }> {
  try {
    const notesPublicReady = await hasNotesPublicColumn();
    const excludeTest = await prismaExcludeTestHandlesLive();
    const scopeWhere = buildPublicPicksScopeWhere(filters, now);
    const plays = await prisma.play.findMany({
      where: {
        ...scopeWhere,
        units: { gte: UNIT_MIN },
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
        eventStartsAt: true,
        book: true,
        closingOddsAmerican: true,
        clvPts: true,
        notes: true,
        ...(notesPublicReady ? { notesPublic: true } : {}),
      },
      orderBy: { createdAt: "desc" },
      // Over-fetch so QA-noted plays dropped below don't shrink the feed.
      take: take * 2,
    });

    const visible = plays
      .filter((p) => !hasQaNoteMarker(p.notes))
      .slice(0, take);

    return { picks: joinPlaysToPublicPicks(visible, cappers), failed: false };
  } catch (error) {
    console.error("[getPublicRecentPicks] database unavailable:", error);
    return { picks: [], failed: true };
  }
}
