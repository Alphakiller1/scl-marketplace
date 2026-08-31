"use server";

import { revalidatePath } from "next/cache";

import {
  allowedExpandedMarkets,
  SOCCER_CONTROL_LEAGUES,
} from "@/lib/odds-control";
import { verificationMarkets } from "@/lib/odds-verify";
import { prisma } from "@/lib/prisma";
import {
  verificationScheduleInputSchema,
  type VerificationScheduleInput,
} from "@/lib/schemas/verification-schedule.schema";
import { requireAdmin } from "@/lib/session";
import {
  easternLocalToUtc,
  nextRecurringVerificationAt,
} from "@/lib/verification-schedule";

type Result = { ok: true } | { ok: false; error: string };

function minutesFromTime(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour! * 60 + minute!;
}

function validateLeague(sport: string, league: string): boolean {
  if (!league) return true;
  if (sport === "SOCCER") {
    return SOCCER_CONTROL_LEAGUES.some((row) => row.key === league);
  }
  return /^[A-Z0-9_:-]{2,100}$/.test(league);
}

export async function createVerificationScheduleAction(
  input: VerificationScheduleInput,
): Promise<Result> {
  const admin = await requireAdmin();
  const parsed = verificationScheduleInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the schedule.",
    };
  }
  const value = parsed.data;
  if (value.scope === "LEAGUE" && !["SOCCER", "TENNIS"].includes(value.sport)) {
    return {
      ok: false,
      error:
        "League-only verification is available for soccer and tennis; use whole slate for this sport.",
    };
  }
  const league = value.scope === "LEAGUE" ? value.league.toUpperCase() : "";
  if (!validateLeague(value.sport, league)) {
    return { ok: false, error: "Select a supported league key." };
  }
  const now = new Date();
  const timeOfDayMinutes = minutesFromTime(value.time);
  const runAt =
    value.recurrence === "ONCE"
      ? easternLocalToUtc(value.date, value.time)
      : null;
  const nextRunAt =
    value.recurrence === "ONCE"
      ? runAt
      : nextRecurringVerificationAt({
          after: now,
          timeOfDayMinutes,
          daysOfWeek: value.daysOfWeek,
        });
  if (!nextRunAt || nextRunAt <= now) {
    return { ok: false, error: "Choose a future Eastern verification time." };
  }

  const sportControl = await prisma.oddsSportControl.findUnique({
    where: { sport: value.sport },
  });
  const surface = sportControl?.surfaceMarkets.length
    ? sportControl.surfaceMarkets
    : ["h2h", "spreads", "totals"];
  const configured = [...surface, ...(sportControl?.expandedMarkets ?? [])];
  const markets = [
    ...new Set(
      value.coverage === "SURFACE"
        ? surface
        : value.coverage === "CONFIGURED"
          ? configured
          : verificationMarkets(value.sport),
    ),
  ].filter((market) =>
    [
      "h2h",
      "spreads",
      "totals",
      ...allowedExpandedMarkets(value.sport),
    ].includes(market),
  );
  if (!markets.length) {
    return {
      ok: false,
      error: "This coverage level has no supported markets.",
    };
  }

  await prisma.$transaction(async (tx) => {
    const schedule = await tx.oddsVerificationSchedule.create({
      data: {
        name: value.name,
        sport: value.sport,
        scope: value.scope,
        league: league || null,
        coverage: value.coverage,
        markets,
        maxEvents: value.maxEvents,
        recurrence: value.recurrence,
        daysOfWeek: value.recurrence === "RECURRING" ? value.daysOfWeek : [],
        timeOfDayMinutes,
        runAt,
        nextRunAt,
        updatedById: admin.id,
      },
    });
    await tx.oddsControlAuditEvent.create({
      data: {
        action: "VERIFICATION_SCHEDULE_CREATED",
        target: schedule.id,
        after: {
          name: schedule.name,
          sport: schedule.sport,
          league: schedule.league,
          recurrence: schedule.recurrence,
          nextRunAt: schedule.nextRunAt?.toISOString(),
        },
        actorId: admin.id,
      },
    });
  });
  revalidatePath("/admin/odds");
  return { ok: true };
}

export async function setVerificationScheduleEnabledAction(input: {
  id: string;
  enabled: boolean;
}): Promise<Result> {
  const admin = await requireAdmin();
  const existing = await prisma.oddsVerificationSchedule.findUnique({
    where: { id: input.id },
  });
  if (!existing) return { ok: false, error: "Schedule not found." };
  let nextRunAt = existing.nextRunAt;
  if (input.enabled && existing.recurrence === "RECURRING") {
    nextRunAt = nextRecurringVerificationAt({
      after: new Date(),
      timeOfDayMinutes: existing.timeOfDayMinutes ?? 0,
      daysOfWeek: existing.daysOfWeek,
    });
  }
  if (
    input.enabled &&
    existing.recurrence === "ONCE" &&
    (!existing.runAt || existing.runAt <= new Date())
  ) {
    return {
      ok: false,
      error: "Past one-time schedules cannot be re-enabled.",
    };
  }
  await prisma.$transaction([
    prisma.oddsVerificationSchedule.update({
      where: { id: input.id },
      data: {
        enabled: input.enabled,
        nextRunAt: input.enabled ? (existing.runAt ?? nextRunAt) : null,
        updatedById: admin.id,
      },
    }),
    prisma.oddsControlAuditEvent.create({
      data: {
        action: input.enabled
          ? "VERIFICATION_SCHEDULE_ENABLED"
          : "VERIFICATION_SCHEDULE_PAUSED",
        target: input.id,
        actorId: admin.id,
      },
    }),
  ]);
  revalidatePath("/admin/odds");
  return { ok: true };
}
