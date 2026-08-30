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
  type OddsControlSettingsInput,
} from "@/lib/schemas/odds-control.schema";
import { requireAdmin } from "@/lib/session";

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
