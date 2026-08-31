import "server-only";

import { Prisma } from "@prisma/client";

import {
  DEFAULT_ODDS_CONTROL_CONFIG,
  isMissingOddsControlStorageError,
  verificationPolicyBlockReason,
  type VerificationPolicy,
} from "@/lib/odds-control";
import { prisma } from "@/lib/prisma";

export type VerificationClaim = {
  runId: string | null;
  cacheMinutes: number;
};

function defaultPolicy(): VerificationPolicy {
  return {
    enabled: DEFAULT_ODDS_CONTROL_CONFIG.verificationEnabled,
    dailyRequestLimit:
      DEFAULT_ODDS_CONTROL_CONFIG.verificationDailyRequestLimit,
    dailyCreditLimit: DEFAULT_ODDS_CONTROL_CONFIG.verificationDailyCreditLimit,
    maxCreditsPerRequest:
      DEFAULT_ODDS_CONTROL_CONFIG.verificationMaxCreditsPerRequest,
    cacheMinutes: DEFAULT_ODDS_CONTROL_CONFIG.verificationCacheMinutes,
    overallDailyLimit: DEFAULT_ODDS_CONTROL_CONFIG.dailyCreditLimit,
    overallWeeklyLimit: DEFAULT_ODDS_CONTROL_CONFIG.weeklyCreditLimit,
    overallMonthlyLimit: DEFAULT_ODDS_CONTROL_CONFIG.monthlyCreditLimit,
  };
}

function utcDay(date: Date): Date {
  const day = new Date(date);
  day.setUTCHours(0, 0, 0, 0);
  return day;
}

/**
 * Atomically reserve one true verification attempt before calling the provider.
 * Missing rollout storage preserves the existing behavior until the migration lands.
 */
export async function claimVerificationRequest(input: {
  sport: string;
  markets: readonly string[];
  now?: Date;
}): Promise<
  { ok: true; claim: VerificationClaim } | { ok: false; reason: string }
> {
  const now = input.now ?? new Date();
  const estimatedCredits = Math.max(1, new Set(input.markets).size);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const config = await tx.oddsControlConfig.findUnique({
            where: { id: "primary" },
          });
          const policy: VerificationPolicy = config
            ? {
                enabled: config.verificationEnabled,
                dailyRequestLimit: config.verificationDailyRequestLimit,
                dailyCreditLimit: config.verificationDailyCreditLimit,
                maxCreditsPerRequest: config.verificationMaxCreditsPerRequest,
                cacheMinutes: config.verificationCacheMinutes,
                overallDailyLimit: config.dailyCreditLimit,
                overallWeeklyLimit: config.weeklyCreditLimit,
                overallMonthlyLimit: config.monthlyCreditLimit,
              }
            : defaultPolicy();
          const today = utcDay(now);
          const week = utcDay(new Date(now.getTime() - 6 * 86_400_000));
          const month = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
          );
          await tx.oddsApiRun.updateMany({
            where: {
              trigger: "VERIFICATION",
              status: "RUNNING",
              startedAt: { lt: new Date(now.getTime() - 15 * 60_000) },
            },
            data: {
              status: "FAILED",
              reservedCredits: 0,
              error: "Verification reservation expired before completion.",
              completedAt: now,
            },
          });
          const [
            verificationActivity,
            allToday,
            allWeek,
            allMonth,
            active,
            latestUsage,
          ] = await Promise.all([
            tx.oddsApiRun.aggregate({
              where: { trigger: "VERIFICATION", startedAt: { gte: today } },
              _count: { _all: true },
              _sum: { credits: true },
            }),
            tx.oddsUsageDaily.aggregate({
              where: { date: { gte: today } },
              _sum: { credits: true },
            }),
            tx.oddsUsageDaily.aggregate({
              where: { date: { gte: week } },
              _sum: { credits: true },
            }),
            tx.oddsUsageDaily.aggregate({
              where: { date: { gte: month } },
              _sum: { credits: true },
            }),
            tx.oddsApiRun.aggregate({
              where: { trigger: "VERIFICATION", status: "RUNNING" },
              _sum: { reservedCredits: true },
            }),
            tx.oddsUsageDaily.findFirst({
              where: { remaining: { not: null } },
              orderBy: { updatedAt: "desc" },
              select: { remaining: true, updatedAt: true },
            }),
          ]);
          const reason = verificationPolicyBlockReason(policy, {
            requestsToday: verificationActivity._count._all,
            creditsToday: verificationActivity._sum.credits ?? 0,
            allCreditsToday: allToday._sum.credits ?? 0,
            allCreditsWeek: allWeek._sum.credits ?? 0,
            allCreditsMonth: allMonth._sum.credits ?? 0,
            reservedCredits: active._sum.reservedCredits ?? 0,
            estimatedCredits,
            providerRemaining: latestUsage?.remaining ?? null,
            providerBalanceUpdatedAt: latestUsage?.updatedAt ?? null,
            now,
          });
          if (reason) return { ok: false as const, reason };
          const run = await tx.oddsApiRun.create({
            data: {
              sport: input.sport,
              tier: "verification",
              trigger: "VERIFICATION",
              status: "RUNNING",
              estimatedCredits,
              reservedCredits: estimatedCredits,
              markets: [...new Set(input.markets)],
            },
          });
          return {
            ok: true as const,
            claim: { runId: run.id, cacheMinutes: policy.cacheMinutes },
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
      if (
        isMissingOddsControlStorageError(error) ||
        (typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2022")
      ) {
        return {
          ok: true,
          claim: {
            runId: null,
            cacheMinutes: defaultPolicy().cacheMinutes,
          },
        };
      }
      throw error;
    }
  }
  throw new Error("Verification reservation retry limit exceeded.");
}

export async function completeVerificationRequest(
  claim: VerificationClaim,
  result: { ok: boolean; credits: number; error?: string },
): Promise<void> {
  if (!claim.runId) return;
  try {
    await prisma.oddsApiRun.update({
      where: { id: claim.runId },
      data: {
        status: result.ok ? "COMPLETED" : "FAILED",
        credits: Math.max(0, Math.round(result.credits)),
        reservedCredits: 0,
        error: result.error?.slice(0, 500),
        completedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("[odds] verification reservation completion failed", error);
  }
}
