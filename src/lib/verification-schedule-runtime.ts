import "server-only";

import { Prisma } from "@prisma/client";

import { oddsReservationBlockReason } from "@/lib/odds-control";
import { prisma } from "@/lib/prisma";
import {
  nextRecurringVerificationAt,
  scheduledVerificationEstimate,
} from "@/lib/verification-schedule";

export type ClaimedVerificationScheduleRun = {
  id: string;
  scheduleId: string;
  sport: string;
  league: string | null;
  markets: string[];
  maxEvents: number;
  estimatedCredits: number;
};

function utcDay(date: Date): Date {
  const day = new Date(date);
  day.setUTCHours(0, 0, 0, 0);
  return day;
}

export async function claimDueVerificationSchedule(
  now = new Date(),
): Promise<ClaimedVerificationScheduleRun | null> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const schedule = await tx.oddsVerificationSchedule.findFirst({
            where: { enabled: true, nextRunAt: { lte: now } },
            orderBy: { nextRunAt: "asc" },
          });
          if (!schedule) return null;
          const config = await tx.oddsControlConfig.findUnique({
            where: { id: "primary" },
          });
          if (!config) return null;

          await tx.oddsApiRun.updateMany({
            where: {
              trigger: "VERIFICATION_SCHEDULE",
              status: "RUNNING",
              startedAt: { lt: new Date(now.getTime() - 15 * 60_000) },
            },
            data: {
              status: "FAILED",
              reservedCredits: 0,
              completedAt: now,
              error: "Scheduled verification lease expired.",
            },
          });
          const today = utcDay(now);
          const week = utcDay(new Date(now.getTime() - 6 * 86_400_000));
          const month = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
          );
          const [
            todayUsage,
            weekUsage,
            monthUsage,
            active,
            verifyActivity,
            latest,
          ] = await Promise.all([
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
              where: { status: "RUNNING" },
              _sum: { reservedCredits: true },
            }),
            tx.oddsApiRun.aggregate({
              where: { trigger: "VERIFICATION", startedAt: { gte: today } },
              _count: { _all: true },
              _sum: { credits: true },
            }),
            tx.oddsUsageDaily.findFirst({
              where: { remaining: { not: null } },
              orderBy: { updatedAt: "desc" },
              select: { remaining: true, updatedAt: true },
            }),
          ]);
          const competitionCount = schedule.league
            ? 1
            : schedule.sport === "SOCCER"
              ? 10
              : schedule.sport === "TENNIS"
                ? 4
                : 1;
          const estimate = scheduledVerificationEstimate({
            markets: schedule.markets,
            maxEvents: schedule.maxEvents,
            surfaceCompetitionCount: competitionCount,
          });
          const verificationEstimate =
            schedule.markets.length * schedule.maxEvents;
          let reason: string | null = null;
          if (!config.verificationEnabled)
            reason = "Owner-disabled verification.";
          else if (
            schedule.markets.length > config.verificationMaxCreditsPerRequest
          ) {
            reason = "Per-verification credit limit exceeded.";
          } else if (
            verifyActivity._count._all + schedule.maxEvents >
            config.verificationDailyRequestLimit
          ) {
            reason = "Daily verification request limit would be exceeded.";
          } else if (
            (verifyActivity._sum.credits ?? 0) + verificationEstimate >
            config.verificationDailyCreditLimit
          ) {
            reason = "Daily verification credit limit would be exceeded.";
          } else {
            reason = oddsReservationBlockReason({
              todayCredits: todayUsage._sum.credits ?? 0,
              weekCredits: weekUsage._sum.credits ?? 0,
              monthCredits: monthUsage._sum.credits ?? 0,
              reservedCredits: active._sum.reservedCredits ?? 0,
              estimatedCredits: estimate,
              dailyLimit: config.dailyCreditLimit,
              weeklyLimit: config.weeklyCreditLimit,
              monthlyLimit: config.monthlyCreditLimit,
              perRunLimit: config.perRunCreditLimit,
              providerRemaining: latest?.remaining ?? null,
              providerBalanceUpdatedAt: latest?.updatedAt ?? null,
              providerReserve: 0,
              now,
            });
          }
          const nextRunAt =
            schedule.recurrence === "RECURRING"
              ? nextRecurringVerificationAt({
                  after: now,
                  timeOfDayMinutes: schedule.timeOfDayMinutes ?? 0,
                  daysOfWeek: schedule.daysOfWeek,
                })
              : null;
          const enabled = schedule.recurrence === "RECURRING";
          await tx.oddsVerificationSchedule.update({
            where: { id: schedule.id },
            data: {
              enabled,
              nextRunAt,
              lastRunAt: now,
              lastStatus: reason ? "BLOCKED" : "RUNNING",
            },
          });
          if (reason) {
            await tx.oddsApiRun.create({
              data: {
                sport: schedule.sport,
                tier: "verification",
                trigger: "VERIFICATION_SCHEDULE",
                status: "BLOCKED",
                estimatedCredits: estimate,
                markets: schedule.markets,
                leagues: schedule.league ? [schedule.league] : [],
                details: {
                  scheduleId: schedule.id,
                  scheduleName: schedule.name,
                },
                error: reason,
                completedAt: now,
              },
            });
            return null;
          }
          const run = await tx.oddsApiRun.create({
            data: {
              sport: schedule.sport,
              tier: "verification",
              trigger: "VERIFICATION_SCHEDULE",
              status: "RUNNING",
              estimatedCredits: estimate,
              reservedCredits: estimate,
              markets: schedule.markets,
              leagues: schedule.league ? [schedule.league] : [],
              details: { scheduleId: schedule.id, scheduleName: schedule.name },
            },
          });
          return {
            id: run.id,
            scheduleId: schedule.id,
            sport: schedule.sport,
            league: schedule.league,
            markets: schedule.markets,
            maxEvents: schedule.maxEvents,
            estimatedCredits: estimate,
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
  throw new Error("Verification schedule claim retry limit exceeded.");
}
