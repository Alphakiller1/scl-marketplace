import "server-only";

import { UNIT_MIN } from "@/lib/constants";
import { withTransientDatabaseRetry } from "@/lib/database-retry";
import { prisma } from "@/lib/prisma";
import { prismaExcludeTestHandlesLive } from "@/lib/public-eligibility-prisma";
import {
  RESULTS_CLIFF_WARNING_DAYS,
  RESULTS_LOOKBACK_DAYS,
} from "@/lib/results/lookback";
import { expectedFinalAt } from "@/lib/results/grading-window";
import { isAutoGradeBlocked } from "@/lib/results/match";

/** Pending past this lag → pipeline UNHEALTHY (Task A). */
const UNHEALTHY_PENDING_HOURS = 24;

export type GradingHealthStatus = "HEALTHY" | "UNHEALTHY";

export type GradingHealthReport = {
  status: GradingHealthStatus;
  /** Back-compat: true when status === HEALTHY. */
  healthy: boolean;
  /** PENDING plays with eventStartsAt older than 24h. */
  pendingPast24h: number;
  /** PENDING plays beyond the sport-specific maximum expected final window. */
  pendingPastExpectedFinal: number;
  /**
   * PENDING plays whose start is older than (LOOKBACK - 1) days — about to
   * become permanently ungradeable via the live scores feed (Task C).
   */
  cliffRisk: number;
  lookbackDays: number;
  cliffWarningDays: number;
};

async function publicPendingCapperFilter() {
  return {
    user: {
      accountStatus: "ACTIVE" as const,
      username: { not: null },
      ...(await prismaExcludeTestHandlesLive()),
    },
  };
}

/**
 * Grading pipeline health for public honesty copy + cron diagnostics.
 * UNHEALTHY when any public-eligible PENDING play is 24h+ past event start.
 */
export async function getGradingHealthReport(
  now = new Date(),
): Promise<GradingHealthReport> {
  const past24h = new Date(
    now.getTime() - UNHEALTHY_PENDING_HOURS * 60 * 60 * 1000,
  );
  const cliffBefore = new Date(
    now.getTime() - RESULTS_CLIFF_WARNING_DAYS * 24 * 60 * 60 * 1000,
  );

  // Keep `listOverduePendingPlays` on this same public-record set. Parlay
  // legs are units=0; counting them as overdue 503'd a HEALTHY grade cron.
  const baseWhere = {
    outcome: "PENDING" as const,
    status: "COMMITTED" as const,
    eventStartsAt: { not: null },
    units: { gte: UNIT_MIN },
    capper: await publicPendingCapperFilter(),
  };

  const pendingPast24h = await withTransientDatabaseRetry(
    () =>
      prisma.play.count({
        where: {
          ...baseWhere,
          eventStartsAt: { not: null, lt: past24h },
        },
      }),
    { label: "grading health pending count" },
  );
  const cliffRisk = await withTransientDatabaseRetry(
    () =>
      prisma.play.count({
        where: {
          ...baseWhere,
          eventStartsAt: { not: null, lt: cliffBefore },
        },
      }),
    { label: "grading health cliff count" },
  );

  const pendingCandidates = await withTransientDatabaseRetry(
    () =>
      prisma.play.findMany({
        where: baseWhere,
        select: { sport: true, market: true, eventStartsAt: true },
        orderBy: { eventStartsAt: "asc" as const },
        take: 1_000,
      }),
    { label: "grading health expected-final inventory" },
  );
  const pendingPastExpectedFinal = pendingCandidates.filter(
    (play) =>
      play.eventStartsAt != null &&
      !isAutoGradeBlocked(play) &&
      expectedFinalAt(play.sport, play.eventStartsAt) <= now,
  ).length;

  const status: GradingHealthStatus =
    pendingPastExpectedFinal > 0 ? "UNHEALTHY" : "HEALTHY";

  return {
    status,
    healthy: status === "HEALTHY",
    pendingPast24h,
    pendingPastExpectedFinal,
    cliffRisk,
    lookbackDays: RESULTS_LOOKBACK_DAYS,
    cliffWarningDays: RESULTS_CLIFF_WARNING_DAYS,
  };
}

/**
 * Boolean helper used by public Ticket copy.
 *
 * Soft-fails, unlike {@link getGradingHealthReport}, which keeps throwing so
 * the admin diagnostics page and the grading cron surface a real outage.
 *
 * The public ledger reads this one. `withTransientDatabaseRetry` rethrows once
 * the retries are spent, and `/picks` has no error boundary above it, so an
 * unreachable database took the whole page down — including the "Couldn't load
 * public picks" state the page already renders for exactly this situation. Its
 * two sibling reads (`getLeaderboardResult`, `getPublicRecentPickRows`) both
 * return `failed: true` instead of throwing; this one probe did not, so it
 * crashed the render before the degraded branch could be reached.
 *
 * Unknown health resolves to NOT healthy on purpose. The flag decides between
 * "GRADES AUTOMATICALLY" and "GRADING DELAYED" on a public receipt, and the
 * first is a promise — one we have no basis to make when the probe just failed.
 */
export async function getGradingHealth(): Promise<boolean> {
  try {
    const report = await getGradingHealthReport();
    return report.healthy;
  } catch (error) {
    console.error("[getGradingHealth] database unavailable:", error);
    return false;
  }
}
