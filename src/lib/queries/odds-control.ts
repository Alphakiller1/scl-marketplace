import "server-only";

import {
  DEFAULT_ODDS_CONTROL_CONFIG,
  defaultSportControl,
  ODDS_CONTROL_SPORTS,
  type OddsControlSport,
} from "@/lib/odds-control";
import { prisma } from "@/lib/prisma";

function utcDay(date: Date): Date {
  const day = new Date(date);
  day.setUTCHours(0, 0, 0, 0);
  return day;
}

function isoOrNull(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

export async function oddsControlStorageReady(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1 FROM scl."OddsControlConfig" LIMIT 1`;
    return true;
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
          warningPercent: config.warningPercent,
          reserveCredits: config.reserveCredits,
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
  const today = utcDay(now);
  const weekStart = utcDay(new Date(now.getTime() - 6 * 86_400_000));
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const historyStart = utcDay(new Date(now.getTime() - 29 * 86_400_000));
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
      },
      bySport: [] as { sport: string; credits: number }[],
      byMarket: [] as { market: string; credits: number }[],
      history: [] as { date: string; credits: number }[],
      recentRuns: [] as Array<{
        id: string;
        sport: string;
        tier: string;
        status: string;
        trigger: string;
        credits: number;
        estimatedCredits: number;
        startedAt: string;
        error: string | null;
      }>,
      audit: [] as Array<{
        id: string;
        action: string;
        target: string;
        actor: string;
        createdAt: string;
      }>,
    };
  }

  const [usage, recentRuns, marketRuns, audit] = await Promise.all([
    prisma.oddsUsageDaily.findMany({
      where: { date: { gte: usageStart } },
      orderBy: [{ date: "asc" }, { updatedAt: "asc" }],
    }),
    prisma.oddsApiRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 50,
    }),
    prisma.oddsApiRun.findMany({
      where: { status: "COMPLETED", startedAt: { gte: monthStart } },
      select: { credits: true, markets: true },
    }),
    prisma.oddsControlAuditEvent.findMany({
      include: { actor: { select: { username: true, displayName: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
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
  const elapsedDays = now.getUTCDate();
  const daysInMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const latestRemaining = [...usage]
    .reverse()
    .find((row) => row.remaining != null)?.remaining;

  const sportCredits = new Map<string, number>();
  for (const row of usage.filter((item) => item.date >= monthStart)) {
    const sport = row.sport || "Unattributed";
    sportCredits.set(sport, (sportCredits.get(sport) ?? 0) + row.credits);
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

  const marketCredits = new Map<string, number>();
  for (const run of marketRuns) {
    if (run.markets.length === 0) continue;
    const share = run.credits / run.markets.length;
    for (const market of run.markets) {
      marketCredits.set(market, (marketCredits.get(market) ?? 0) + share);
    }
  }

  return {
    settings,
    summary: {
      today: todayCredits,
      week: weekCredits,
      month: monthCredits,
      remaining: latestRemaining ?? null,
      percentUsed: monthlyLimit > 0 ? (monthCredits / monthlyLimit) * 100 : 0,
      projectedMonth: Math.round((monthCredits / elapsedDays) * daysInMonth),
    },
    bySport: [...sportCredits.entries()]
      .map(([sport, credits]) => ({ sport, credits }))
      .sort((a, b) => b.credits - a.credits),
    byMarket: [...marketCredits.entries()]
      .map(([market, credits]) => ({ market, credits }))
      .sort((a, b) => b.credits - a.credits),
    history: [...daily.entries()].map(([date, credits]) => ({ date, credits })),
    recentRuns: recentRuns.map((run) => ({
      id: run.id,
      sport: run.sport,
      tier: run.tier,
      status: run.status,
      trigger: run.trigger,
      credits: run.credits,
      estimatedCredits: run.estimatedCredits,
      startedAt: run.startedAt.toISOString(),
      error: run.error,
    })),
    audit: audit.map((event) => ({
      id: event.id,
      action: event.action,
      target: event.target,
      actor:
        event.actor?.username ?? event.actor?.displayName ?? "Former admin",
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

export type OddsCreditDashboard = Awaited<
  ReturnType<typeof getOddsCreditDashboard>
>;

export function isOddsControlSport(value: string): value is OddsControlSport {
  return (ODDS_CONTROL_SPORTS as readonly string[]).includes(value);
}
