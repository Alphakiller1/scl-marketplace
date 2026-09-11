import "server-only";

import { Prisma } from "@prisma/client";

import {
  canReserveOddsCredits,
  CREDIT_WINDOW_DAYS,
  creditWindowStart,
  estimatedRunCredits,
  isMissingOddsControlStorageError,
  oddsReservationBlockReason,
  utcDayStart,
  type OddsControlTier,
} from "@/lib/odds-control";
import { expandedCatchUpRunAt } from "@/lib/manual-odds-population";
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
    // Explicit select: this runs on the on-demand event board that pick entry
    // depends on, so it must not name a column a pending migration has not
    // added yet. The daily allowance is read separately, where a missing column
    // degrades to the default instead of failing the request.
    const policy = await prisma.oddsSportControl.findUnique({
      where: { sport: sport.trim().toUpperCase() },
      select: {
        enabled: true,
        surfaceEnabled: true,
        expandedEnabled: true,
        surfaceMarkets: true,
        expandedMarkets: true,
        leagues: true,
      },
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

/**
 * Bring the expanded tier back for fixtures that have never had a board.
 *
 * The expanded pass reads the slate off the CACHED surface board, so a fixture
 * the provider lists after that pass has run is invisible to it — not held, not
 * skipped, not capped, just absent — and the run reports a clean sweep. On
 * 2026-09-11 the MLB expanded pass at 06:45 UTC saw the 12 games the 06:15
 * surface run had found and bought all 12. The 12:15 surface run found 15. The
 * three that arrived in between (Pirates at Cubs, Dodgers at Marlins, Rangers
 * at Diamondbacks) carried no alternates and no props all day, because the
 * expanded cadence is 720 minutes and the next pass was due at 18:45 — after
 * the Cubs game had started.
 *
 * So coverage, not just the clock, decides when the tier is due. This only ever
 * moves the next run earlier, and never inside the catch-up floor.
 */
export async function scheduleExpandedCatchUp(
  sport: string,
  uncovered: number,
  now = new Date(),
): Promise<Date | null> {
  if (uncovered <= 0) return null;
  try {
    const policy = await prisma.oddsSportControl.findUnique({
      where: { sport: sport.trim().toUpperCase() },
      select: {
        id: true,
        enabled: true,
        expandedEnabled: true,
        expandedMarkets: true,
        nextExpandedRunAt: true,
        lastExpandedRunAt: true,
      },
    });
    // A sport whose expanded tier is off or has no markets has nothing to come
    // back for; pulling its schedule forward would only queue a no-op run.
    if (!policy?.enabled || !policy.expandedEnabled) return null;
    if (policy.expandedMarkets.length === 0) return null;

    const at = expandedCatchUpRunAt({
      uncovered,
      scheduledAt: policy.nextExpandedRunAt,
      lastRunAt: policy.lastExpandedRunAt,
      now,
    });
    if (!at) return null;
    await prisma.oddsSportControl.update({
      where: { id: policy.id },
      data: { nextExpandedRunAt: at },
    });
    console.info("[odds-control] expanded catch-up scheduled", {
      sport,
      uncovered,
      at: at.toISOString(),
    });
    return at;
  } catch (error) {
    // Never fail a populate over the schedule nudge — the board it just wrote
    // is worth more than the pass it was trying to queue.
    if (isMissingOddsControlStorageError(error)) return null;
    console.warn("[odds-control] expanded catch-up failed", {
      sport,
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function nextRunAt(now: Date, cadenceMinutes: number): Date {
  return new Date(now.getTime() + cadenceMinutes * 60_000);
}

/**
 * How soon a run refused on credits is offered again.
 *
 * Short enough that headroom opening up is picked up the same hour, long
 * enough that a hard-blocked account is not re-evaluated every tick.
 */
const BLOCKED_RETRY_MINUTES = 20;

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

          const dayStart = utcDayStart(now);
          const weekStart = creditWindowStart(now, CREDIT_WINDOW_DAYS.week);
          const monthStart = creditWindowStart(now, CREDIT_WINDOW_DAYS.month);
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
              // Positive only. The provider writes -1 when a response carried
              // no `x-requests-remaining` header, which means "balance unknown"
              // — but the reserve guard reads it as a balance, so an unknown
              // one blocked every run in the account while 73,746 credits sat
              // unspent. Unknown must not read as almost-empty. A genuinely low
              // balance still reads low and still blocks.
              where: { remaining: { gt: 0 } },
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
            // A run refused on credits has not been done, so it must not
            // consume its slot: advancing a 240-minute cadence on a block cost
            // four hours of a stale board the first time this ran, off one
            // transient refusal. Blocked work comes back on a short retry
            // instead, which is still bounded — the guard re-decides every
            // time, so a genuinely exhausted budget just refuses again for a
            // few credits' worth of nothing.
            const next = allowed
              ? nextRunAt(now, cadenceMinutes)
              : nextRunAt(now, BLOCKED_RETRY_MINUTES);
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

          const dayStart = utcDayStart(now);
          const weekStart = creditWindowStart(now, CREDIT_WINDOW_DAYS.week);
          const monthStart = creditWindowStart(now, CREDIT_WINDOW_DAYS.month);
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
              // Positive only. The provider writes -1 when a response carried
              // no `x-requests-remaining` header, which means "balance unknown"
              // — but the reserve guard reads it as a balance, so an unknown
              // one blocked every run in the account while 73,746 credits sat
              // unspent. Unknown must not read as almost-empty. A genuinely low
              // balance still reads low and still blocks.
              where: { remaining: { gt: 0 } },
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
