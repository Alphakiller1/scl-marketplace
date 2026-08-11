import { NextRequest, NextResponse } from "next/server";

import { withTransientDatabaseRetry } from "@/lib/database-retry";
import { ODDS_BOARD_SPORTS, preGameEvents } from "@/lib/game-picker";
import { loadCachedOddsBoard } from "@/lib/odds-board-cache";
import { getCachedOddsCoverageReport } from "@/lib/odds-coverage-report";
import { probeOddsProvider } from "@/lib/odds-provider-health";
import { prisma } from "@/lib/prisma";
import { databasePoolConfiguration } from "@/lib/prisma-url";
import { prismaExcludeTestHandlesLive } from "@/lib/public-eligibility-prisma";
import { getCoreSchemaHealth } from "@/lib/queries/release-readiness";
import { getPublicRecentPickRows } from "@/lib/queries/plays";
import {
  getLegacyPackageIntegrityForAdmin,
  listActiveMarketplacePackagesResult,
} from "@/lib/queries/store";
import { nearTermEvents } from "@/lib/slate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");
  if (!secret) return process.env.NODE_ENV !== "production";
  return authorization === secret || authorization === `Bearer ${secret}`;
}

/**
 * Authenticated production acceptance probe.
 *
 * This intentionally exercises independent database-backed stories together.
 * A single SELECT 1 or HTTP 200 allowed the prior one-connection pool failure
 * to pass while leaderboard, packages, and picks silently rendered fallbacks.
 */
export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pool = databasePoolConfiguration(process.env.DATABASE_URL);
  const excludeTest = await withTransientDatabaseRetry(
    () => prismaExcludeTestHandlesLive(),
    { label: "deep health public eligibility" },
  );

  const [schema, publicCappers, picks, marketplace, legacy, odds, oddsBoards] =
    await Promise.all([
      getCoreSchemaHealth(),
      withTransientDatabaseRetry(
        () =>
          prisma.capperProfile.count({
            where: {
              user: {
                username: { not: null },
                accountStatus: "ACTIVE",
                ...excludeTest,
              },
            },
          }),
        { label: "deep health public cappers" },
      ),
      getPublicRecentPickRows(1),
      listActiveMarketplacePackagesResult(),
      getLegacyPackageIntegrityForAdmin(),
      probeOddsProvider(),
      Promise.all(
        ODDS_BOARD_SPORTS.map(async (sport) => ({
          sport: sport.key,
          board: await loadCachedOddsBoard(sport.key),
        })),
      ),
    ]);

  const oddsBoardEvents = oddsBoards.flatMap(({ board }) => board.events);
  const selectableOddsBoardEvents = nearTermEvents(
    preGameEvents(oddsBoardEvents),
  );
  const oddsCoverage = await getCachedOddsCoverageReport();

  const checks = {
    databaseSchema: schema.ready,
    fluidPool:
      pool.pooled && pool.connectionLimit !== null && pool.connectionLimit >= 5,
    leaderboardData: publicCappers > 0,
    picksData: !picks.failed && picks.plays.length > 0,
    marketplaceData: !marketplace.failed && marketplace.packages.length > 0,
    legacyPackages:
      !legacy.failed &&
      legacy.errors.length === 0 &&
      legacy.lineage.errors.length === 0,
    oddsProvider: odds.configured && odds.reachable,
    oddsSelectionBoard: selectableOddsBoardEvents.length > 0,
    oddsExpandedBoards: oddsCoverage.cacheComplete,
  };
  const ready = Object.values(checks).every(Boolean);
  const result = {
    status: ready ? "ok" : "degraded",
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    checks,
    counts: {
      publicCappers,
      publicPicks: picks.plays.length,
      publicPackages: marketplace.packages.length,
      legacyPackages: legacy.stats.total,
      legacyWhopPackages: legacy.stats.whop,
      oddsBoardEvents: oddsBoardEvents.length,
      selectableOddsBoardEvents: selectableOddsBoardEvents.length,
    },
    legacy: {
      stats: legacy.stats,
      lineage: legacy.lineage,
      errors: legacy.errors,
    },
    odds,
    oddsBoard: {
      sources: Object.fromEntries(
        oddsBoards.map(({ sport, board }) => [sport, board.source]),
      ),
      stale: oddsBoards.some(({ board }) => board.stale),
    },
    oddsCoverage,
    databasePool: pool,
    durationMs: Date.now() - startedAt,
    checkedAt: new Date().toISOString(),
  };

  const log = {
    level: ready ? "info" : "error",
    event: "production_deep_health",
    ready,
    checks,
    durationMs: result.durationMs,
  };
  (ready ? console.info : console.error)(JSON.stringify(log));

  return NextResponse.json(result, {
    status: ready ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
