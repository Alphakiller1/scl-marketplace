"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/app-url";
import { executeClaimedOddsRun } from "@/lib/odds-control-executor";
import { claimManualOddsRun } from "@/lib/odds-control-runtime";
import {
  oddsControlSettingsSchema,
  oddsRunRequestSchema,
  oddsTeamTotalTopUpSchema,
  type OddsControlSettingsInput,
} from "@/lib/schemas/odds-control.schema";
import { requireAdmin } from "@/lib/session";
import { TEAM_TOTAL_MARKET_KEYS } from "@/lib/team-total-markets";

type ActionResult =
  | { ok: true; message?: string; credits?: number }
  | { ok: false; error: string };

function auditJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function saveOddsControlSettingsAction(
  input: OddsControlSettingsInput,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = oddsControlSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the API controls.",
    };
  }

  const next = parsed.data;
  try {
    await prisma.$transaction(async (tx) => {
      const [beforeConfig, beforeSports] = await Promise.all([
        tx.oddsControlConfig.findUnique({ where: { id: "primary" } }),
        tx.oddsSportControl.findMany({ orderBy: { sport: "asc" } }),
      ]);
      await tx.oddsControlConfig.upsert({
        where: { id: "primary" },
        create: {
          id: "primary",
          managedSchedulingEnabled: next.managedSchedulingEnabled,
          paused: next.paused,
          dailyCreditLimit: next.dailyCreditLimit,
          weeklyCreditLimit: next.weeklyCreditLimit,
          monthlyCreditLimit: next.monthlyCreditLimit,
          perRunCreditLimit: next.perRunCreditLimit,
          warningPercent: next.warningPercent,
          reserveCredits: next.reserveCredits,
          verificationEnabled: next.verificationEnabled,
          verificationDailyRequestLimit: next.verificationDailyRequestLimit,
          verificationDailyCreditLimit: next.verificationDailyCreditLimit,
          verificationMaxCreditsPerRequest:
            next.verificationMaxCreditsPerRequest,
          verificationCacheMinutes: next.verificationCacheMinutes,
          timezone: next.timezone,
          updatedById: admin.id,
        },
        update: {
          managedSchedulingEnabled: next.managedSchedulingEnabled,
          paused: next.paused,
          dailyCreditLimit: next.dailyCreditLimit,
          weeklyCreditLimit: next.weeklyCreditLimit,
          monthlyCreditLimit: next.monthlyCreditLimit,
          perRunCreditLimit: next.perRunCreditLimit,
          warningPercent: next.warningPercent,
          reserveCredits: next.reserveCredits,
          verificationEnabled: next.verificationEnabled,
          verificationDailyRequestLimit: next.verificationDailyRequestLimit,
          verificationDailyCreditLimit: next.verificationDailyCreditLimit,
          verificationMaxCreditsPerRequest:
            next.verificationMaxCreditsPerRequest,
          verificationCacheMinutes: next.verificationCacheMinutes,
          timezone: next.timezone,
          updatedById: admin.id,
        },
      });
      const now = new Date();
      for (const sport of next.sports) {
        const existing = beforeSports.find((row) => row.sport === sport.sport);
        await tx.oddsSportControl.upsert({
          where: { sport: sport.sport },
          create: {
            ...sport,
            nextSurfaceRunAt: sport.surfaceEnabled ? now : null,
            nextExpandedRunAt: sport.expandedEnabled ? now : null,
            updatedById: admin.id,
          },
          update: {
            enabled: sport.enabled,
            surfaceEnabled: sport.surfaceEnabled,
            expandedEnabled: sport.expandedEnabled,
            surfaceMarkets: sport.surfaceMarkets,
            expandedMarkets: sport.expandedMarkets,
            dailyVerificationLimit: sport.dailyVerificationLimit,
            leagues: sport.leagues,
            surfaceCadenceMinutes: sport.surfaceCadenceMinutes,
            expandedCadenceMinutes: sport.expandedCadenceMinutes,
            maxEventsPerRun: sport.maxEventsPerRun,
            nextSurfaceRunAt:
              sport.enabled && sport.surfaceEnabled
                ? (existing?.nextSurfaceRunAt ?? now)
                : null,
            nextExpandedRunAt:
              sport.enabled && sport.expandedEnabled
                ? (existing?.nextExpandedRunAt ?? now)
                : null,
            updatedById: admin.id,
          },
        });
      }
      await tx.oddsControlAuditEvent.create({
        data: {
          action: "SETTINGS_SAVED",
          target: "odds-control",
          before: auditJson({ config: beforeConfig, sports: beforeSports }),
          after: auditJson(next),
          actorId: admin.id,
        },
      });
    });
    revalidatePath("/admin/odds");
    return { ok: true };
  } catch (error) {
    console.error("[odds-control] save failed", error);
    return {
      ok: false,
      error:
        "API control storage is unavailable. Apply the migration and retry.",
    };
  }
}

export async function runOddsNowAction(input: {
  sport: string;
  tier: "surface" | "expanded";
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = oddsRunRequestSchema.safeParse({
    sport: input?.sport?.trim().toUpperCase(),
    tier: input?.tier,
  });
  if (!parsed.success) {
    return { ok: false, error: "Unknown sport or refresh tier." };
  }
  const { sport, tier } = parsed.data;
  try {
    const claimed = await claimManualOddsRun({
      sport,
      tier,
      triggeredById: admin.id,
    });
    if (!claimed.ok) return claimed;
    const result = await executeClaimedOddsRun(appUrl(), claimed.run);
    await prisma.oddsControlAuditEvent.create({
      data: {
        action: "RUN_NOW",
        target: `${sport}:${tier}`,
        after: { sport, tier, runId: result.id, credits: result.credits },
        actorId: admin.id,
      },
    });
    revalidatePath("/admin/odds");
    return result.ok
      ? {
          ok: true,
          credits: result.credits,
          message: `Refresh completed using ${result.credits.toLocaleString()} credits.`,
        }
      : { ok: false, error: "Refresh started but the provider run failed." };
  } catch (error) {
    console.error("[odds-control] run now failed", error);
    return { ok: false, error: "Could not complete the refresh." };
  }
}

export async function dryRunOddsAction(input: {
  sport: string;
  tier: "surface" | "expanded";
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = oddsRunRequestSchema.safeParse({
    sport: input?.sport?.trim().toUpperCase(),
    tier: input?.tier,
  });
  if (!parsed.success) {
    return { ok: false, error: "Unknown sport or refresh tier." };
  }
  try {
    const preview = await claimManualOddsRun({
      ...parsed.data,
      triggeredById: admin.id,
      dryRun: true,
    });
    if (!preview.ok) return preview;
    await prisma.oddsControlAuditEvent.create({
      data: {
        action: "DRY_RUN",
        target: `${parsed.data.sport}:${parsed.data.tier}`,
        after: {
          sport: parsed.data.sport,
          tier: parsed.data.tier,
          runId: preview.run.id,
          estimate: preview.run.estimatedCredits,
          message: preview.message,
        },
        actorId: admin.id,
      },
    });
    revalidatePath("/admin/odds");
    return { ok: true, message: preview.message, credits: 0 };
  } catch (error) {
    console.error("[odds-control] dry run failed", error);
    return { ok: false, error: "Could not simulate the refresh." };
  }
}

function topUpCounts(
  details: Record<string, unknown> | undefined,
  sport: string,
) {
  const expanded = details?.expanded;
  const row =
    expanded && typeof expanded === "object"
      ? (expanded as Record<string, unknown>)[sport]
      : undefined;
  const read = (key: string): number => {
    if (!row || typeof row !== "object") return 0;
    const value = (row as Record<string, unknown>)[key];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  };
  return {
    games: read("events"),
    asked: read("topUpAttempts"),
    filled: read("toppedUp"),
    held: read("held"),
  };
}

/**
 * Fill the team-total ladders on today's boards without rebuying them.
 *
 * Asks only for team totals, only on games whose board is missing a club's
 * ladder, and adds what comes back — a credit or two a game. Pressing it skips
 * the hourly spacing between automatic top-ups, but not the credit reserve and
 * not the owner's market switches: a sport with team totals turned off is
 * refused rather than quietly bought.
 */
export async function fillTeamTotalLaddersAction(input: {
  sport: string;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = oddsTeamTotalTopUpSchema.safeParse({
    sport: input?.sport?.trim().toUpperCase(),
  });
  if (!parsed.success) return { ok: false, error: "Unknown sport." };
  const { sport } = parsed.data;
  try {
    const claimed = await claimManualOddsRun({
      sport,
      tier: "expanded",
      triggeredById: admin.id,
      markets: TEAM_TOTAL_MARKET_KEYS,
      topUp: { force: true },
    });
    if (!claimed.ok) return claimed;
    const result = await executeClaimedOddsRun(appUrl(), claimed.run);
    const counts = topUpCounts(result.details, sport);
    await prisma.oddsControlAuditEvent.create({
      data: {
        action: "TEAM_TOTAL_TOPUP",
        target: `${sport}:expanded`,
        after: auditJson({
          sport,
          runId: result.id,
          credits: result.credits,
          ...counts,
        }),
        actorId: admin.id,
      },
    });
    revalidatePath("/admin/odds");
    if (!result.ok) {
      return {
        ok: false,
        error: "Top-up started but the provider run failed.",
      };
    }
    if (counts.asked === 0 && counts.held === 0) {
      return {
        ok: true,
        credits: result.credits,
        message: `Every ${sport} board in the window already carries both team-total ladders.`,
      };
    }
    const notPosted = counts.asked - counts.filled;
    const parts = [`ladders added on ${counts.filled}`];
    if (notPosted > 0) parts.push(`${notPosted} not posted by any book yet`);
    if (counts.held > 0) {
      parts.push(`${counts.held} held back for the credit reserve`);
    }
    return {
      ok: true,
      credits: result.credits,
      message: `${sport} team totals: ${parts.join(", ")}. ${result.credits.toLocaleString()} credits.`,
    };
  } catch (error) {
    console.error("[odds-control] team-total top-up failed", error);
    return { ok: false, error: "Could not fill the team-total ladders." };
  }
}
