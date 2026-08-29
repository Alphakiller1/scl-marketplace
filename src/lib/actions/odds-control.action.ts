"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  oddsControlSettingsSchema,
  type OddsControlSettingsInput,
} from "@/lib/schemas/odds-control.schema";
import { requireAdmin } from "@/lib/session";

type ActionResult = { ok: true } | { ok: false; error: string };

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

export async function queueOddsRunAction(input: {
  sport: string;
  tier: "surface" | "expanded";
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!(["surface", "expanded"] as const).includes(input.tier)) {
    return { ok: false, error: "Unknown refresh tier." };
  }
  try {
    const existing = await prisma.oddsSportControl.findUnique({
      where: { sport: input.sport },
    });
    if (!existing?.enabled) {
      return { ok: false, error: "Enable this sport before queueing a run." };
    }
    await prisma.$transaction([
      prisma.oddsSportControl.update({
        where: { sport: input.sport },
        data:
          input.tier === "surface"
            ? { nextSurfaceRunAt: new Date() }
            : { nextExpandedRunAt: new Date() },
      }),
      prisma.oddsControlAuditEvent.create({
        data: {
          action: "RUN_QUEUED",
          target: `${input.sport}:${input.tier}`,
          after: { sport: input.sport, tier: input.tier },
          actorId: admin.id,
        },
      }),
    ]);
    revalidatePath("/admin/odds");
    return { ok: true };
  } catch (error) {
    console.error("[odds-control] queue failed", error);
    return { ok: false, error: "Could not queue the refresh." };
  }
}
