import "server-only";

import type { Prisma } from "@prisma/client";

import {
  classifyCandidates,
  FIXTURE_WINDOW_MS,
  type ClassifiedCandidates,
  type CorrectionPlay,
} from "@/lib/bulk-correction";
import { accountLabel } from "@/lib/identity";
import { prisma } from "@/lib/prisma";

/**
 * Hard ceiling on the rows one game can contribute. The busiest NFL slate in
 * the last 30 days had well under this many plays on one event; hitting it
 * means something is wrong, and the admin is told rather than shown a silently
 * partial list.
 */
export const CANDIDATE_POOL_LIMIT = 2000;

const correctionPlaySelect = {
  id: true,
  capperId: true,
  sport: true,
  market: true,
  selection: true,
  side: true,
  line: true,
  eventId: true,
  eventLabel: true,
  homeTeam: true,
  awayTeam: true,
  eventStartsAt: true,
  createdAt: true,
  oddsAmerican: true,
  units: true,
  outcome: true,
  profitUnits: true,
  capper: {
    select: { user: { select: { username: true, displayName: true } } },
  },
  parlay: {
    select: {
      id: true,
      units: true,
      outcome: true,
      profitUnits: true,
      legs: {
        orderBy: { createdAt: "asc" },
        select: { id: true, outcome: true, oddsAmerican: true },
      },
    },
  },
} satisfies Prisma.PlaySelect;

type CorrectionPlayRow = Prisma.PlayGetPayload<{
  select: typeof correctionPlaySelect;
}>;

function toNumber(value: { toString(): string } | null): number | null {
  return value == null ? null : Number(value);
}

export function toCorrectionPlay(row: CorrectionPlayRow): CorrectionPlay {
  return {
    id: row.id,
    capperId: row.capperId,
    capperLabel: accountLabel(row.capper.user, "Unknown capper"),
    sport: row.sport,
    market: row.market,
    selection: row.selection,
    side: row.side,
    line: toNumber(row.line),
    eventId: row.eventId,
    eventLabel: row.eventLabel,
    homeTeam: row.homeTeam,
    awayTeam: row.awayTeam,
    eventStartsAt: row.eventStartsAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    oddsAmerican: row.oddsAmerican,
    units: Number(row.units),
    outcome: row.outcome,
    profitUnits: toNumber(row.profitUnits),
    parlay: row.parlay
      ? {
          id: row.parlay.id,
          units: Number(row.parlay.units),
          outcome: row.parlay.outcome,
          profitUnits: toNumber(row.parlay.profitUnits),
          legs: row.parlay.legs,
        }
      : null,
  };
}

function around(time: Date) {
  return {
    gte: new Date(time.getTime() - FIXTURE_WINDOW_MS),
    lte: new Date(time.getTime() + FIXTURE_WINDOW_MS),
  };
}

/**
 * A superset of the plays on the same game as `source`. The pure `sameEvent`
 * decides; this only keeps the scan to the rows that could possibly pass.
 */
function sameGameWhere(source: CorrectionPlayRow): Prisma.PlayWhereInput[] {
  const clauses: Prisma.PlayWhereInput[] = [];
  if (source.eventId) clauses.push({ eventId: source.eventId });
  const home = source.homeTeam?.trim();
  const away = source.awayTeam?.trim();
  const start =
    source.eventStartsAt ?? (source.eventId ? null : source.createdAt);
  if (home && away && start) {
    clauses.push({
      // A play bound to a different provider event is a different game, even
      // between the same clubs (doubleheaders): only unbound rows fall back.
      ...(source.eventId ? { eventId: null } : {}),
      homeTeam: { equals: home, mode: "insensitive" },
      awayTeam: { equals: away, mode: "insensitive" },
      OR: [
        { eventStartsAt: around(start) },
        { eventStartsAt: null, eventId: null, createdAt: around(start) },
      ],
    });
  }
  return clauses;
}

export type CorrectionCandidates = ClassifiedCandidates & {
  /** True when the pool hit `CANDIDATE_POOL_LIMIT` — the list may be partial. */
  truncated: boolean;
};

/**
 * For each source play (a straight play, or a parlay leg), every committed play
 * by any capper on the same game, split into the identical pick and related
 * picks. One pool query for all sources, so a ten-leg ticket is one round trip.
 */
export async function loadCorrectionCandidates(
  sourcePlayIds: readonly string[],
): Promise<Map<string, CorrectionCandidates>> {
  const result = new Map<string, CorrectionCandidates>();
  if (sourcePlayIds.length === 0) return result;

  const sources = await prisma.play.findMany({
    where: { id: { in: [...sourcePlayIds] }, status: "COMMITTED" },
    select: correctionPlaySelect,
  });
  const clauses = sources.flatMap(sameGameWhere);
  const pool = clauses.length
    ? await prisma.play.findMany({
        where: { status: "COMMITTED", OR: clauses },
        select: correctionPlaySelect,
        orderBy: { createdAt: "asc" },
        take: CANDIDATE_POOL_LIMIT,
      })
    : [];
  const truncated = pool.length >= CANDIDATE_POOL_LIMIT;
  const poolPlays = pool.map(toCorrectionPlay);

  for (const row of sources) {
    const source = toCorrectionPlay(row);
    result.set(source.id, {
      ...classifyCandidates(source, poolPlays),
      truncated,
    });
  }
  return result;
}
