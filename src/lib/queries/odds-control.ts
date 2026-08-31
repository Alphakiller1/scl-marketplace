import "server-only";

import {
  CREDIT_WINDOW_DAYS,
  creditWindowStart,
  DEFAULT_ODDS_CONTROL_CONFIG,
  defaultSportControl,
  ODDS_CONTROL_SPORTS,
  utcDayStart,
  type OddsControlSport,
} from "@/lib/odds-control";
import {
  describeOddsAuditChange,
  identifyUsageSpikes,
  summarizeOddsRunDetails,
} from "@/lib/odds-control-reporting";
import {
  LEAGUE_PICK_DEMAND_WINDOW_DAYS,
  summarizeLeaguePickDemand,
} from "@/lib/odds-demand";
import { prisma } from "@/lib/prisma";

function isoOrNull(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

export async function oddsControlStorageReady(): Promise<boolean> {
  try {
    const [result] = await prisma.$queryRaw<Array<{ ready: boolean }>>`
      SELECT
        to_regclass('scl."OddsControlConfig"') IS NOT NULL AND
        to_regclass('scl."OddsSportControl"') IS NOT NULL AND
        to_regclass('scl."OddsApiRun"') IS NOT NULL AND
        to_regclass('scl."OddsUsageMarketDaily"') IS NOT NULL AND
        to_regclass('scl."OddsControlAuditEvent"') IS NOT NULL AND
        to_regclass('scl."OddsVerificationSchedule"') IS NOT NULL AND
        (
          SELECT COUNT(*) = 5
          FROM information_schema.columns
          WHERE table_schema = 'scl'
            AND table_name = 'OddsControlConfig'
            AND column_name IN (
              'verificationEnabled',
              'verificationDailyRequestLimit',
              'verificationDailyCreditLimit',
              'verificationMaxCreditsPerRequest',
              'verificationCacheMinutes'
            )
        ) AS ready
    `;
    return result?.ready === true;
  } catch {
    return false;
  }
}

export async function getOddsControlSettings() {
  const defaults = ODDS_CONTROL_SPORTS.map(defaultSportControl);
  if (!(await oddsControlStorageReady())) {
    return {
      storageReady: false,
      config: { ...DEFAULT_ODDS_CONTROL_CONFIG },
      sports: defaults,
      updatedAt: null as string | null,
      updatedBy: null as string | null,
    };
  }

  const [config, storedSports] = await Promise.all([
    prisma.oddsControlConfig.findUnique({
      where: { id: "primary" },
      include: {
        updatedBy: { select: { username: true, displayName: true } },
      },
    }),
    prisma.oddsSportControl.findMany(),
  ]);
  const bySport = new Map(storedSports.map((row) => [row.sport, row]));
  return {
    storageReady: true,
    config: config
      ? {
          managedSchedulingEnabled: config.managedSchedulingEnabled,
          paused: config.paused,
          dailyCreditLimit: config.dailyCreditLimit,
          weeklyCreditLimit: config.weeklyCreditLimit,
          monthlyCreditLimit: config.monthlyCreditLimit,
          perRunCreditLimit: config.perRunCreditLimit,
          warningPercent: config.warningPercent,
          reserveCredits: config.reserveCredits,
          verificationEnabled: config.verificationEnabled,
          verificationDailyRequestLimit: config.verificationDailyRequestLimit,
          verificationDailyCreditLimit: config.verificationDailyCreditLimit,
          verificationMaxCreditsPerRequest:
            config.verificationMaxCreditsPerRequest,
          verificationCacheMinutes: config.verificationCacheMinutes,
          timezone: "America/New_York" as const,
        }
      : { ...DEFAULT_ODDS_CONTROL_CONFIG },
    sports: defaults.map((fallback) => {
      const stored = bySport.get(fallback.sport);
      if (!stored) return fallback;
      return {
        sport: fallback.sport,
        enabled: stored.enabled,
        surfaceEnabled: stored.surfaceEnabled,
        expandedEnabled: stored.expandedEnabled,
        surfaceMarkets: stored.surfaceMarkets,
        expandedMarkets: stored.expandedMarkets,
        leagues: stored.leagues,
        surfaceCadenceMinutes: stored.surfaceCadenceMinutes,
        expandedCadenceMinutes: stored.expandedCadenceMinutes,
        maxEventsPerRun: stored.maxEventsPerRun,
        dailyVerificationLimit: stored.dailyVerificationLimit,
        nextSurfaceRunAt: isoOrNull(stored.nextSurfaceRunAt),
        nextExpandedRunAt: isoOrNull(stored.nextExpandedRunAt),
        lastSurfaceRunAt: isoOrNull(stored.lastSurfaceRunAt),
        lastExpandedRunAt: isoOrNull(stored.lastExpandedRunAt),
      };
    }),
    updatedAt: config?.updatedAt.toISOString() ?? null,
    updatedBy:
      config?.updatedBy?.username ?? config?.updatedBy?.displayName ?? null,
  };
}

export async function getOddsCreditDashboard() {
  const settings = await getOddsControlSettings();
  const now = new Date();
  const today = utcDayStart(now);
  const weekStart = creditWindowStart(now, CREDIT_WINDOW_DAYS.week);
  const monthStart = creditWindowStart(now, CREDIT_WINDOW_DAYS.month);
  const historyStart = creditWindowStart(now, 30);
  const usageStart = monthStart < historyStart ? monthStart : historyStart;

  if (!settings.storageReady) {
    return {
      settings,
      summary: {
        today: 0,
        week: 0,
        month: 0,
        remaining: null as number | null,
        percentUsed: 0,
        projectedMonth: 0,
        provider: {
          state: "unknown" as const,
          capacity: null as number | null,
          updatedAt: null as string | null,
          ageMinutes: null as number | null,
          refreshedSports: 0,
          staleSports: [] as string[],
          lastRunAt: null as string | null,
        },
      },
      bySport: [] as { sport: string; credits: number }[],
      byPurpose: [] as { purpose: string; credits: number; calls: number }[],
      byMarket: [] as { market: string; credits: number; calls: number }[],
      verification: { requestsToday: 0, creditsToday: 0 },
      history: [] as {
        date: string;
        credits: number;
        trailingAverage: number;
        spike: boolean;
      }[],
      recentRuns: [] as Array<{
        id: string;
        sport: string;
        tier: string;
        status: string;
        trigger: string;
        credits: number;
        estimatedCredits: number;
        startedAt: string;
        completedAt: string | null;
        remaining: number | null;
        markets: string[];
        leagues: string[];
        details: ReturnType<typeof summarizeOddsRunDetails>;
        error: string | null;
      }>,
      audit: [] as Array<{
        id: string;
        action: string;
        target: string;
        actor: string;
        createdAt: string;
        changes: string[];
      }>,
    };
  }

  const [usage, recentRuns, marketUsage, audit, verificationActivityToday] =
    await Promise.all([
      prisma.oddsUsageDaily.findMany({
        where: { date: { gte: usageStart } },
        orderBy: [{ date: "asc" }, { updatedAt: "asc" }],
      }),
      prisma.oddsApiRun.findMany({
        orderBy: { startedAt: "desc" },
        take: 50,
      }),
      prisma.oddsUsageMarketDaily.findMany({
        where: { date: { gte: monthStart } },
        orderBy: [{ credits: "desc" }, { market: "asc" }],
      }),
      prisma.oddsControlAuditEvent.findMany({
        include: { actor: { select: { username: true, displayName: true } } },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.oddsApiRun.aggregate({
        where: { trigger: "VERIFICATION", startedAt: { gte: today } },
        _count: { _all: true },
        _sum: { credits: true },
      }),
    ]);

  const creditsSince = (start: Date) =>
    usage
      .filter((row) => row.date >= start)
      .reduce((sum, row) => sum + row.credits, 0);
  const todayCredits = creditsSince(today);
  const weekCredits = creditsSince(weekStart);
  const monthCredits = creditsSince(monthStart);
  const monthlyLimit = settings.config.monthlyCreditLimit;
  // Days of usage the rolling window actually covers. Once the ledger is older
  // than the window this is the full 30 and the projection equals the trailing
  // total, which is the right answer for a rolling window — no run-rate
  // guesswork survives into a period that has already been measured.
  const earliestUsage = usage.find((row) => row.date >= monthStart)?.date;
  const observedDays = Math.min(
    CREDIT_WINDOW_DAYS.month,
    Math.max(
      1,
      earliestUsage
        ? Math.round((today.getTime() - earliestUsage.getTime()) / 86_400_000) +
            1
        : 1,
    ),
  );
  const latestProviderUsage = [...usage]
    .reverse()
    .find((row) => row.remaining != null);
  const latestRemaining = latestProviderUsage?.remaining;

  const sportCredits = new Map<string, number>();
  const purposeUsage = new Map<string, { credits: number; calls: number }>();
  for (const row of usage.filter((item) => item.date >= monthStart)) {
    const sport = row.sport || "Unattributed";
    sportCredits.set(sport, (sportCredits.get(sport) ?? 0) + row.credits);
    const purpose = purposeUsage.get(row.purpose) ?? { credits: 0, calls: 0 };
    purpose.credits += row.credits;
    purpose.calls += row.calls;
    purposeUsage.set(row.purpose, purpose);
  }

  const daily = new Map<string, number>();
  for (let index = 0; index < 30; index += 1) {
    const date = new Date(historyStart.getTime() + index * 86_400_000);
    daily.set(date.toISOString().slice(0, 10), 0);
  }
  for (const row of usage) {
    if (row.date < historyStart) continue;
    const key = row.date.toISOString().slice(0, 10);
    daily.set(key, (daily.get(key) ?? 0) + row.credits);
  }

  const marketCredits = new Map<string, { credits: number; calls: number }>();
  for (const row of marketUsage) {
    const current = marketCredits.get(row.market) ?? { credits: 0, calls: 0 };
    current.credits += row.credits;
    current.calls += row.calls;
    marketCredits.set(row.market, current);
  }
  const history = identifyUsageSpikes(
    [...daily.entries()].map(([date, credits]) => ({ date, credits })),
  );
  const newestRun = recentRuns.find((run) => run.trigger !== "DRY_RUN");
  const newestDetails = summarizeOddsRunDetails(newestRun?.details);
  const providerAgeMinutes = latestProviderUsage
    ? Math.max(
        0,
        Math.round(
          (now.getTime() - latestProviderUsage.updatedAt.getTime()) / 60_000,
        ),
      )
    : null;
  const providerState =
    latestRemaining == null
      ? ("unknown" as const)
      : providerAgeMinutes != null && providerAgeMinutes > 24 * 60
        ? ("stale" as const)
        : latestRemaining <= 0
          ? ("exhausted" as const)
          : latestRemaining <= settings.config.reserveCredits
            ? ("reserve" as const)
            : ("healthy" as const);

  return {
    settings,
    summary: {
      today: todayCredits,
      week: weekCredits,
      month: monthCredits,
      remaining: latestRemaining ?? null,
      percentUsed: monthlyLimit > 0 ? (monthCredits / monthlyLimit) * 100 : 0,
      projectedMonth: Math.round(
        (monthCredits / observedDays) * CREDIT_WINDOW_DAYS.month,
      ),
      provider: {
        state: providerState,
        capacity: latestProviderUsage?.capacity ?? null,
        updatedAt: latestProviderUsage?.updatedAt.toISOString() ?? null,
        ageMinutes: providerAgeMinutes,
        refreshedSports: newestDetails.refreshedSports,
        staleSports: newestDetails.staleSports,
        lastRunAt: newestRun?.completedAt?.toISOString() ?? null,
      },
    },
    bySport: [...sportCredits.entries()]
      .map(([sport, credits]) => ({ sport, credits }))
      .sort((a, b) => b.credits - a.credits),
    byPurpose: [...purposeUsage.entries()]
      .map(([purpose, value]) => ({ purpose, ...value }))
      .sort((a, b) => b.credits - a.credits),
    byMarket: [...marketCredits.entries()]
      .map(([market, value]) => ({ market, ...value }))
      .sort((a, b) => b.credits - a.credits),
    verification: {
      requestsToday: verificationActivityToday._count._all,
      creditsToday: verificationActivityToday._sum.credits ?? 0,
    },
    history,
    recentRuns: recentRuns.map((run) => ({
      id: run.id,
      sport: run.sport,
      tier: run.tier,
      status: run.status,
      trigger: run.trigger,
      credits: run.credits,
      estimatedCredits: run.estimatedCredits,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
      remaining: run.remaining,
      markets: run.markets,
      leagues: run.leagues,
      details: summarizeOddsRunDetails(run.details),
      error: run.error,
    })),
    audit: audit.map((event) => ({
      id: event.id,
      action: event.action,
      target: event.target,
      actor:
        event.actor?.username ?? event.actor?.displayName ?? "Former admin",
      createdAt: event.createdAt.toISOString(),
      changes: describeOddsAuditChange({
        action: event.action,
        target: event.target,
        before: event.before,
        after: event.after,
      }),
    })),
  };
}

/** Admin-only demand signal for deciding which league boards deserve credits. */
export async function getLeaguePickDemand(now = new Date()) {
  const since = new Date(
    now.getTime() - LEAGUE_PICK_DEMAND_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
  try {
    const rows = await prisma.play.groupBy({
      by: ["sport", "league", "capperId"],
      where: {
        createdAt: { gte: since },
        status: "COMMITTED",
        capper: {
          user: {
            role: "CAPPER",
            accountStatus: "ACTIVE",
            isTest: false,
          },
        },
      },
      _count: { _all: true },
      _max: { createdAt: true },
    });
    return {
      storageReady: true,
      windowDays: LEAGUE_PICK_DEMAND_WINDOW_DAYS,
      leagues: summarizeLeaguePickDemand(
        rows.flatMap((row) =>
          row._max.createdAt
            ? [
                {
                  sport: row.sport,
                  league: row.league,
                  capperId: row.capperId,
                  pickCount: row._count._all,
                  lastPickAt: row._max.createdAt,
                },
              ]
            : [],
        ),
      ),
    };
  } catch (error) {
    console.error("[odds-control] league pick demand unavailable", error);
    return {
      storageReady: false,
      windowDays: LEAGUE_PICK_DEMAND_WINDOW_DAYS,
      leagues: [],
    };
  }
}

export async function getVerificationSchedules() {
  if (!(await oddsControlStorageReady())) return [];
  const rows = await prisma.oddsVerificationSchedule.findMany({
    orderBy: [{ enabled: "desc" }, { nextRunAt: "asc" }, { createdAt: "desc" }],
    take: 50,
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    sport: row.sport,
    scope: row.scope,
    league: row.league,
    coverage: row.coverage,
    markets: row.markets,
    maxEvents: row.maxEvents,
    recurrence: row.recurrence,
    daysOfWeek: row.daysOfWeek,
    timeOfDayMinutes: row.timeOfDayMinutes,
    runAt: isoOrNull(row.runAt),
    nextRunAt: isoOrNull(row.nextRunAt),
    lastRunAt: isoOrNull(row.lastRunAt),
    lastStatus: row.lastStatus,
    enabled: row.enabled,
  }));
}

export type OddsCreditDashboard = Awaited<
  ReturnType<typeof getOddsCreditDashboard>
>;

export function isOddsControlSport(value: string): value is OddsControlSport {
  return (ODDS_CONTROL_SPORTS as readonly string[]).includes(value);
}
