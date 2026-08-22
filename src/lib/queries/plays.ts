import "server-only";

import type { Outcome } from "@prisma/client";

import { withTransientDatabaseRetry } from "@/lib/database-retry";
import { prisma } from "@/lib/prisma";
import {
  sortLegacySportRecords,
  type LegacySportRecordView,
} from "@/lib/legacy-sport-records";
import { stakeFromStored } from "@/lib/extreme-stake";
import {
  allTimeLegacyRecordWhere,
  collapseLegacyRecordsBySport,
  normalizeLegacyAggregateRow,
  statsBaselineFromLegacyRows,
} from "@/lib/legacy-all-time";
import { LEGACY_RECORD_ALL_SPORTS } from "@/lib/schemas/legacy-records.schema";
import type { StatsBaseline } from "@/lib/stats";
import type { CapperSummary, TodayPick } from "@/lib/mock";
import {
  joinPlaysToPublicPicks,
  type PublicPlayJoinRow,
} from "@/lib/public-picks";
import {
  DEFAULT_PUBLIC_PICKS_FILTERS,
  type PublicPicksLedgerFilters,
} from "@/lib/public-picks-ledger";
import { buildPublicPicksScopeWhere } from "@/lib/public-picks-scope";
import { hasQaNoteMarker } from "@/lib/public-eligibility";
import { buildPublishedStraightPlayWhere } from "@/lib/queries/published-play-where";
import {
  hasClvColumns,
  hasNotesPublicColumn,
} from "@/lib/results/schema-features";
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
  eventLabel?: string | null;
  /**
   * Stored fixture teams. Reconstruct the matchup line via `matchupLabel` when
   * `eventLabel` is absent — it only exists on picks logged after the board
   * started recording it.
   */
  homeTeam?: string | null;
  awayTeam?: string | null;
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
  /** Server-side disclosure state for pending paid selections. */
  isEmbargoed?: boolean;
  embargoedUntil?: Date | null;
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
  /** Verified Only when every leg was logged pre-game and price-verified. */
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

export type CapperLegacyRecords = {
  /** Combined all-time carry, ready to hand to computeCapperStats. */
  baseline: StatsBaseline | null;
  /** Per-sport all-time rows for the dashboard's By Sport table. */
  bySport: LegacySportRecordView[];
};

/**
 * A capper's carried-over totals from the previous SCL platform.
 *
 * The dashboard computed its record from Play rows alone while every public
 * surface added this baseline, so a capper saw one career on their own
 * dashboard and a different one on their public profile — 518 graded against
 * 1,946 for the capper who reported it. Same numbers, same source, both places.
 *
 * All-time carry: `PRE_IMPORT` (current year minus imported receipts) plus
 * prior complete years. Trailing windows, seasons, and `CURRENT_YEAR` overlap
 * those rows — summing them would double-count. One capper still carries ~60
 * of those overlapping rows; they stay stored and unused for standings.
 */
export async function getCapperLegacyRecords(
  userId: string,
): Promise<CapperLegacyRecords> {
  const profile = await prisma.capperProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) return { baseline: null, bySport: [] };

  const rows = await prisma.legacyRecord.findMany({
    where: { capperId: profile.id, ...allTimeLegacyRecordWhere },
    select: {
      sport: true,
      wins: true,
      losses: true,
      pushes: true,
      unitsRisked: true,
      unitsNet: true,
    },
  });
  if (rows.length === 0) return { baseline: null, bySport: [] };

  const normalized = collapseLegacyRecordsBySport(
    rows.map(normalizeLegacyAggregateRow),
  );

  const combined = normalized.find(
    (row) => row.sport === LEGACY_RECORD_ALL_SPORTS,
  );

  return {
    baseline: combined ? statsBaselineFromLegacyRows([combined]) : null,
    // sortLegacySportRecords drops the ALL sentinel and any empty row.
    bySport: sortLegacySportRecords(
      normalized.map((row) => ({
        sport: row.sport ?? LEGACY_RECORD_ALL_SPORTS,
        wins: row.wins,
        losses: row.losses,
        pushes: row.pushes,
        unitsRisked: row.unitsRisked,
        unitsNet: row.unitsNet,
      })),
    ),
  };
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
  const clvReady = await hasClvColumns();
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
      eventLabel: true,
      homeTeam: true,
      awayTeam: true,
      book: true,
      notes: true,
      ...(notesPublicReady ? { notesPublic: true } : {}),
      ...(clvReady ? { closingOddsAmerican: true, clvPts: true } : {}),
    },
  });

  return plays.map((p) => {
    const stake = stakeFromStored(p.units, p.profitUnits);
    return {
      id: p.id,
      sport: p.sport,
      league: p.league,
      market: p.market,
      selection: p.selection,
      oddsAmerican: p.oddsAmerican,
      units: stake.units,
      outcome: p.outcome,
      profitUnits: stake.profitUnits,
      createdAt: p.createdAt,
      verificationTier: p.verificationTier,
      side: p.side,
      eventStartsAt: p.eventStartsAt,
      eventLabel: p.eventLabel,
      homeTeam: p.homeTeam,
      awayTeam: p.awayTeam,
      book: p.book,
      notes: p.notes,
      notesPublic:
        "notesPublic" in p
          ? ((p as { notesPublic?: boolean }).notesPublic ?? true)
          : true,
      closingOddsAmerican:
        "closingOddsAmerican" in p &&
        (p as { closingOddsAmerican?: number | null }).closingOddsAmerican !=
          null
          ? Number((p as { closingOddsAmerican: number }).closingOddsAmerican)
          : null,
      clvPts:
        "clvPts" in p && (p as { clvPts?: unknown }).clvPts != null
          ? Number((p as { clvPts: unknown }).clvPts)
          : null,
    };
  });
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

  return parlays.map((p) => {
    const stake = stakeFromStored(p.units, p.profitUnits);
    return {
      id: p.id,
      combinedOddsAmerican: p.combinedOddsAmerican,
      units: stake.units,
      outcome: p.outcome,
      profitUnits: stake.profitUnits,
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
    };
  });
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
  const result = await getPublicRecentPickRows(take, filters, now);
  return {
    picks: joinPlaysToPublicPicks(result.plays, cappers, now),
    failed: result.failed,
  };
}

/**
 * Fetch the bounded public feed independently from capper summaries.
 *
 * The Picks page needs both this list and the leaderboard, but the database
 * queries do not depend on one another. Keeping the fetch separate lets the
 * route start both requests together rather than adding the feed latency to
 * the leaderboard latency during navigation.
 */
export async function getPublicRecentPickRows(
  take = 8,
  filters: PublicPicksLedgerFilters = DEFAULT_PUBLIC_PICKS_FILTERS,
  now: Date = new Date(),
): Promise<{ plays: PublicPlayJoinRow[]; failed: boolean }> {
  try {
    const plays = await withTransientDatabaseRetry(
      async () => {
        const notesPublicReady = await hasNotesPublicColumn();
        const publicationWhere = await buildPublishedStraightPlayWhere();
        const scopeWhere = buildPublicPicksScopeWhere(filters, now);
        return prisma.play.findMany({
          where: {
            ...publicationWhere,
            ...scopeWhere,
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
            eventLabel: true,
            homeTeam: true,
            awayTeam: true,
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
      },
      { label: "public picks feed" },
    );

    const visible = plays
      .filter((p) => !hasQaNoteMarker(p.notes))
      .slice(0, take);

    return { plays: visible, failed: false };
  } catch (error) {
    console.error("[getPublicRecentPicks] database unavailable:", error);
    return { plays: [], failed: true };
  }
}
