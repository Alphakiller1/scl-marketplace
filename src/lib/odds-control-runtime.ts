import "server-only";

import { Prisma } from "@prisma/client";

import {
  canReserveOddsCredits,
  estimatedRunCredits,
  isMissingOddsControlStorageError,
  oddsReservationBlockReason,
  type OddsControlTier,
} from "@/lib/odds-control";
import { prisma } from "@/lib/prisma";

export type ClaimedOddsRun = {
  id: string;
  sport: string;
  tier: OddsControlTier;
  markets: string[];
  leagues: string[];
  maxEventsPerRun: number;
  cadenceMinutes: number;
  estimatedCredits: number;
};

export async function managedOddsSchedulingEnabled(): Promise<boolean> {
  try {
    const config = await prisma.oddsControlConfig.findUnique({
      where: { id: "primary" },
      select: { managedSchedulingEnabled: true },
    });
    return config?.managedSchedulingEnabled ?? false;
  } catch (error) {
    // Safe rollout: before the migration exists, legacy scheduling remains live.
    if (isMissingOddsControlStorageError(error)) return false;
    throw error;
  }
}

export async function getManagedOddsSportControl(sport: string) {
  try {
    const config = await prisma.oddsControlConfig.findUnique({
      where: { id: "primary" },
      select: { managedSchedulingEnabled: true, paused: true },
    });
    if (!config?.managedSchedulingEnabled) return null;
    const policy = await prisma.oddsSportControl.findUnique({
      where: { sport: sport.trim().toUpperCase() },
    });
    return policy
      ? {
          managed: true as const,
          paused: config.paused,
          enabled: policy.enabled,
          surfaceEnabled: policy.surfaceEnabled,
          expandedEnabled: policy.expandedEnabled,
          surfaceMarkets: policy.surfaceMarkets,
          expandedMarkets: policy.expandedMarkets,
          leagues: policy.leagues,
        }
      : {
          managed: true as const,
          paused: config.paused,
          enabled: false,
          surfaceEnabled: false,
          expandedEnabled: false,
          surfaceMarkets: [] as string[],
          expandedMarkets: [] as string[],
          leagues: [] as string[],
        };
  } catch (error) {
    if (isMissingOddsControlStorageError(error)) return null;
    throw error;
  }
}

function utcDay(date: Date): Date {
  const value = new Date(date);
  value.setUTCHours(0, 0, 0, 0);
  return value;
}

function nextRunAt(now: Date, cadenceMinutes: number): Date {
  return new Date(now.getTime() + cadenceMinutes * 60_000);
}

export async function claimDueOddsRuns(
  now = new Date(),
  maxClaims = 2,
): Promise<{
  state: "disabled" | "paused" | "idle" | "claimed";
  runs: ClaimedOddsRun[];
}> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const config = await tx.oddsControlConfig.findUnique({
            where: { id: "primary" },
          });
          if (!config?.managedSchedulingEnabled) {
            return { state: "disabled" as const, runs: [] };
          }
          if (config.paused) return { state: "paused" as const, runs: [] };

          await tx.oddsApiRun.updateMany({
            where: {
              status: "RUNNING",
              startedAt: { lt: new Date(now.getTime() - 15 * 60_000) },
            },
            data: {
              status: "FAILED",
              reservedCredits: 0,
              completedAt: now,
              error: "Run lease expired before completion.",
            },
          });

          const policies = await tx.oddsSportControl.findMany({
            where: { enabled: true },
            orderBy: { sport: "asc" },
          });
          const candidates = policies.flatMap((policy) => {
            const rows: Array<{
              policy: typeof policy;
              tier: OddsControlTier;
              dueAt: Date;
            }> = [];
            if (
              policy.surfaceEnabled &&
              policy.surfaceMarkets.length > 0 &&
              policy.nextSurfaceRunAt &&
              policy.nextSurfaceRunAt <= now
            ) {
              rows.push({
                policy,
                tier: "surface",
                dueAt: policy.nextSurfaceRunAt,
              });
            }
            if (
              policy.expandedEnabled &&
              policy.expandedMarkets.length > 0 &&
              policy.nextExpandedRunAt &&
              policy.nextExpandedRunAt <= now
            ) {
              rows.push({
                policy,
                tier: "expanded",
                dueAt: policy.nextExpandedRunAt,
              });
            }
            return rows;
          });
          candidates.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
          if (!candidates.length) return { state: "idle" as const, runs: [] };

          const dayStart = utcDay(now);
          const weekStart = utcDay(new Date(now.getTime() - 6 * 86_400_000));
          const monthStart = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
          );
          const [today, week, month, active, latestUsage] = await Promise.all([
            tx.oddsUsageDaily.aggregate({
              where: { date: { gte: dayStart } },
              _sum: { credits: true },
            }),
            tx.oddsUsageDaily.aggregate({
              where: { date: { gte: weekStart } },
              _sum: { credits: true },
            }),
            tx.oddsUsageDaily.aggregate({
              where: { date: { gte: monthStart } },
              _sum: { credits: true },
            }),
            tx.oddsApiRun.aggregate({
              where: { status: "RUNNING" },
              _sum: { reservedCredits: true },
            }),
            tx.oddsUsageDaily.findFirst({
              where: { remaining: { not: null } },
              orderBy: { updatedAt: "desc" },
              select: { remaining: true, updatedAt: true },
            }),
          ]);
          let reserved = active._sum.reservedCredits ?? 0;
          const claimed: ClaimedOddsRun[] = [];

          for (const candidate of candidates) {
            if (claimed.length >= maxClaims) break;
            const policy = candidate.policy;
            const markets =
              candidate.tier === "surface"
                ? policy.surfaceMarkets
                : policy.expandedMarkets;
            const cadenceMinutes =
              candidate.tier === "surface"
                ? policy.surfaceCadenceMinutes
                : policy.expandedCadenceMinutes;
            const estimate = estimatedRunCredits({
              sport: policy.sport,
              tier: candidate.tier,
              markets,
              leagues: policy.leagues,
              maxEventsPerRun: policy.maxEventsPerRun,
            });
            const allowed = canReserveOddsCredits({
              todayCredits: today._sum.credits ?? 0,
              weekCredits: week._sum.credits ?? 0,
              monthCredits: month._sum.credits ?? 0,
              reservedCredits: reserved,
              estimatedCredits: estimate,
              dailyLimit: config.dailyCreditLimit,
              weeklyLimit: config.weeklyCreditLimit,
              monthlyLimit: config.monthlyCreditLimit,
              perRunLimit: config.perRunCreditLimit,
              providerRemaining: latestUsage?.remaining ?? null,
              providerBalanceUpdatedAt: latestUsage?.updatedAt ?? null,
              providerReserve: config.reserveCredits,
              now,
            });
            const next = nextRunAt(now, cadenceMinutes);
            const scheduleUpdate =
              candidate.tier === "surface"
                ? { nextSurfaceRunAt: next, lastSurfaceRunAt: now }
                : { nextExpandedRunAt: next, lastExpandedRunAt: now };
            await tx.oddsSportControl.update({
              where: { id: policy.id },
              data: scheduleUpdate,
            });
            if (!allowed) {
              await tx.oddsApiRun.create({
                data: {
                  sport: policy.sport,
                  tier: candidate.tier,
                  trigger: "SCHEDULED",
                  status: "BLOCKED",
                  estimatedCredits: estimate,
                  markets,
                  leagues: policy.leagues,
                  completedAt: now,
                  error:
                    "Owner credit limit or protected reserve would be exceeded.",
                },
              });
              continue;
            }
            const run = await tx.oddsApiRun.create({
              data: {
                sport: policy.sport,
                tier: candidate.tier,
                trigger: "SCHEDULED",
                status: "RUNNING",
                estimatedCredits: estimate,
                reservedCredits: estimate,
                markets,
                leagues: policy.leagues,
              },
            });
            reserved += estimate;
            claimed.push({
              id: run.id,
              sport: policy.sport,
              tier: candidate.tier,
              markets,
              leagues: policy.leagues,
              maxEventsPerRun: policy.maxEventsPerRun,
              cadenceMinutes,
              estimatedCredits: estimate,
            });
          }
          return {
            state: claimed.length ? ("claimed" as const) : ("idle" as const),
            runs: claimed,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      const transactionConflict =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2034";
      if (transactionConflict && attempt < 3) continue;
      console.error("[odds-control] dispatcher claim failed", error);
      throw error;
    }
  }
  throw new Error("Odds dispatcher claim retry limit exceeded.");
}

export async function claimManualOddsRun(input: {
  sport: string;
  tier: OddsControlTier;
  triggeredById: string;
  dryRun?: boolean;
  now?: Date;
}): Promise<
  | { ok: true; run: ClaimedOddsRun; dryRun: boolean; message: string }
  | { ok: false; error: string }
> {
  const now = input.now ?? new Date();
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const [config, policy] = await Promise.all([
            tx.oddsControlConfig.findUnique({ where: { id: "primary" } }),
            tx.oddsSportControl.findUnique({
              where: { sport: input.sport.trim().toUpperCase() },
            }),
          ]);
          if (!config?.managedSchedulingEnabled) {
            return {
              ok: false as const,
              error:
                "Enable owner-managed scheduling before running a refresh.",
            };
          }
          if (config.paused && !input.dryRun) {
            return {
              ok: false as const,
              error: "Resume optional API pulls before running a refresh.",
            };
          }
          if (!policy?.enabled) {
            return { ok: false as const, error: "Enable this sport first." };
          }
          const tierEnabled =
            input.tier === "surface"
              ? policy.surfaceEnabled
              : policy.expandedEnabled;
          const markets =
            input.tier === "surface"
              ? policy.surfaceMarkets
              : policy.expandedMarkets;
          if (!tierEnabled || markets.length === 0) {
            return {
              ok: false as const,
              error: `Enable the ${input.tier} tier and select its markets first.`,
            };
          }

          const dayStart = utcDay(now);
          const weekStart = utcDay(new Date(now.getTime() - 6 * 86_400_000));
          const monthStart = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
          );
          const [today, week, month, active, latestUsage] = await Promise.all([
            tx.oddsUsageDaily.aggregate({
              where: { date: { gte: dayStart } },
              _sum: { credits: true },
            }),
            tx.oddsUsageDaily.aggregate({
              where: { date: { gte: weekStart } },
              _sum: { credits: true },
            }),
            tx.oddsUsageDaily.aggregate({
              where: { date: { gte: monthStart } },
              _sum: { credits: true },
            }),
            tx.oddsApiRun.aggregate({
              where: { status: "RUNNING" },
              _sum: { reservedCredits: true },
            }),
            tx.oddsUsageDaily.findFirst({
              where: { remaining: { not: null } },
              orderBy: { updatedAt: "desc" },
              select: { remaining: true, updatedAt: true },
            }),
          ]);
          const estimate = estimatedRunCredits({
            sport: policy.sport,
            tier: input.tier,
            markets,
            leagues: policy.leagues,
            maxEventsPerRun: policy.maxEventsPerRun,
          });
          const reason = oddsReservationBlockReason({
            todayCredits: today._sum.credits ?? 0,
            weekCredits: week._sum.credits ?? 0,
            monthCredits: month._sum.credits ?? 0,
            reservedCredits: active._sum.reservedCredits ?? 0,
            estimatedCredits: estimate,
            dailyLimit: config.dailyCreditLimit,
            weeklyLimit: config.weeklyCreditLimit,
            monthlyLimit: config.monthlyCreditLimit,
            perRunLimit: config.perRunCreditLimit,
            providerRemaining: latestUsage?.remaining ?? null,
            providerBalanceUpdatedAt: latestUsage?.updatedAt ?? null,
            providerReserve: config.reserveCredits,
            now,
          });
          const cadenceMinutes =
            input.tier === "surface"
              ? policy.surfaceCadenceMinutes
              : policy.expandedCadenceMinutes;

          if (input.dryRun) {
            const record = await tx.oddsApiRun.create({
              data: {
                sport: policy.sport,
                tier: input.tier,
                trigger: "DRY_RUN",
                status: "COMPLETED",
                estimatedCredits: estimate,
                credits: 0,
                markets,
                leagues: policy.leagues,
                details: {
                  dryRun: true,
                  wouldRun: reason === null,
                  blockedReason: reason,
                  maxEventsPerRun: policy.maxEventsPerRun,
                },
                triggeredById: input.triggeredById,
                completedAt: now,
              },
            });
            return {
              ok: true as const,
              dryRun: true,
              message: reason
                ? `Dry run blocked: ${reason}`
                : `Dry run passed: up to ${estimate.toLocaleString()} credits.`,
              run: {
                id: record.id,
                sport: policy.sport,
                tier: input.tier,
                markets,
                leagues: policy.leagues,
                maxEventsPerRun: policy.maxEventsPerRun,
                cadenceMinutes,
                estimatedCredits: estimate,
              },
            };
          }
          if (reason) return { ok: false as const, error: reason };

          const record = await tx.oddsApiRun.create({
            data: {
              sport: policy.sport,
              tier: input.tier,
              trigger: "MANUAL",
              status: "RUNNING",
              estimatedCredits: estimate,
              reservedCredits: estimate,
              markets,
              leagues: policy.leagues,
              triggeredById: input.triggeredById,
            },
          });
          return {
            ok: true as const,
            dryRun: false,
            message: "Run started.",
            run: {
              id: record.id,
              sport: policy.sport,
              tier: input.tier,
              markets,
              leagues: policy.leagues,
              maxEventsPerRun: policy.maxEventsPerRun,
              cadenceMinutes,
              estimatedCredits: estimate,
            },
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      const conflict =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2034";
      if (conflict && attempt < 3) continue;
      throw error;
    }
  }
  throw new Error("Manual odds run claim retry limit exceeded.");
}

export async function completeOddsRun(
  id: string,
  result: {
    ok: boolean;
    credits: number;
    remaining: number | null;
    details: unknown;
    error?: string;
  },
): Promise<void> {
  await prisma.oddsApiRun.update({
    where: { id },
    data: {
      status: result.ok ? "COMPLETED" : "FAILED",
      credits: Math.max(0, Math.round(result.credits)),
      remaining: result.remaining,
      reservedCredits: 0,
      details: JSON.parse(
        JSON.stringify(result.details),
      ) as Prisma.InputJsonValue,
      error: result.error,
      completedAt: new Date(),
    },
  });
}

export async function failOddsRun(id: string, error: unknown): Promise<void> {
  await prisma.oddsApiRun.update({
    where: { id },
    data: {
      status: "FAILED",
      reservedCredits: 0,
      error:
        error instanceof Error
          ? error.message.slice(0, 500)
          : String(error).slice(0, 500),
      completedAt: new Date(),
    },
  });
}
