import { NextRequest, NextResponse } from "next/server";

import { expandedBoardMarkets } from "@/lib/odds-verify";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * One-shot handover of odds population to the owner-managed scheduler.
 *
 * `OddsControlConfig.managedSchedulingEnabled` has been false since the control
 * plane shipped, and that one flag made the whole thing inert:
 * `claimDueOddsRuns` returns "disabled" (so `OddsApiRun` has never recorded a
 * single run) and `getManagedOddsSportControl` returns null (so the entry board
 * applies no owner market filtering either). Everything was bought by the fixed
 * cron list in vercel.json instead, which is why the dashboard looked dead
 * while the boards stayed current. `/api/cron/odds-populate` already stands
 * down for unmanaged callers once the flag is on, so this is a handover rather
 * than a second buyer.
 *
 * It runs HERE, behind CRON_SECRET, for the same reason `/api/admin/db-patch`
 * does: GitHub runners cannot reach the Supabase database, and the repository
 * `DATABASE_URL` secret points at a different project entirely. Vercel reaches
 * the real one, so the workflow curls this and the write happens inside the
 * deployment.
 *
 * IDEMPOTENT AND ONE-SHOT. The audit row it writes is also its guard: a second
 * call finds that row and changes nothing, so a redeploy or a re-dispatch can
 * never overwrite settings the owners have since changed in the dashboard.
 * `?force=1` overrides that deliberately; `?dryRun=1` reports the plan.
 */
const AUDIT_ACTION = "managed_scheduling.enable";

/** Minutes from now, so the first wave drains in order at 2 claims per tick. */
const STAGGER: Record<string, { surface: number; expanded: number }> = {
  NFL: { surface: 0, expanded: 10 },
  MLB: { surface: 2, expanded: 30 },
  NCAAF: { surface: 4, expanded: 0 },
  SOCCER: { surface: 6, expanded: 40 },
  TENNIS: { surface: 8, expanded: 50 },
  MMA: { surface: 12, expanded: 0 },
  CFL: { surface: 14, expanded: 0 },
  WNBA: { surface: 16, expanded: 60 },
};

type SportPatch = {
  enabled?: boolean;
  surfaceEnabled?: boolean;
  expandedEnabled?: boolean;
  expandedMarkets?: string[];
  expandedCadenceMinutes?: number;
  maxEventsPerRun?: number;
};

/**
 * What each sport is set to before the flag moves, because from that moment the
 * config IS the schedule.
 *
 * NFL's market list is read from `expandedBoardMarkets` rather than restated,
 * so it cannot drift out of step with the code — the populate route filters
 * what it is handed through `allowedExpandedMarkets`, and a stale key would be
 * silently dropped rather than fetched.
 */
function sportUpdates(): Record<string, SportPatch> {
  return {
    NFL: {
      enabled: true,
      surfaceEnabled: true,
      expandedEnabled: true,
      expandedMarkets: expandedBoardMarkets("NFL"),
      expandedCadenceMinutes: 360,
      maxEventsPerRun: 16,
    },
    // Cappers posted 35 and 7 plays in the last fortnight against rows reading
    // `enabled: false`. Both would go dark the moment the crons stand down.
    MMA: { enabled: true, surfaceEnabled: true },
    CFL: { enabled: true, surfaceEnabled: true },
    // `estimatedRunCredits` reserves markets x maxEventsPerRun, so a 20-event
    // ceiling on a 15-game slate over-reserves by a third and blocks other
    // sports for nothing.
    MLB: { expandedCadenceMinutes: 720, maxEventsPerRun: 15 },
    WNBA: { expandedCadenceMinutes: 720, maxEventsPerRun: 12 },
  };
}

/**
 * 3,250 left no room: the board spent 3,658 the day before this shipped, with
 * MLB alone taking 3,173. 3,400 is also the month's sustainable pace. The
 * monthly limit stays the real guardrail, and the per-event allowance of one is
 * what actually bounds the deep board now.
 */
const DAILY_CREDIT_LIMIT = 3400;

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(
    secret && req.headers.get("authorization") === `Bearer ${secret}`,
  );
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get("force") === "1";
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const updates = sportUpdates();
  const now = new Date();

  const applied = await prisma.oddsControlAuditEvent.findFirst({
    where: { action: AUDIT_ACTION },
    orderBy: { createdAt: "desc" },
  });
  if (applied && !force) {
    return NextResponse.json({
      ok: true,
      skipped: "already-applied",
      appliedAt: applied.createdAt,
    });
  }

  const config = await prisma.oddsControlConfig.findUnique({
    where: { id: "primary" },
  });
  if (!config) {
    return NextResponse.json(
      { ok: false, error: "No OddsControlConfig row — nothing to flip." },
      { status: 500 },
    );
  }

  const before = await prisma.oddsSportControl.findMany({
    orderBy: { sport: "asc" },
  });

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      managedSchedulingEnabled: config.managedSchedulingEnabled,
      dailyCreditLimit: config.dailyCreditLimit,
      wouldApply: updates,
      wouldSetDailyCreditLimit: DAILY_CREDIT_LIMIT,
      sports: before.map((row) => ({
        sport: row.sport,
        enabled: row.enabled,
        expandedEnabled: row.expandedEnabled,
        expandedMarkets: row.expandedMarkets.length,
      })),
    });
  }

  // Sport rows first. The flag moves last so the scheduler never observes a
  // half-configured slate.
  const touched: string[] = [];
  for (const row of before) {
    const patch = updates[row.sport];
    const stagger = STAGGER[row.sport];
    const willBeEnabled = patch?.enabled ?? row.enabled;
    if (!patch && !willBeEnabled) continue;

    const surfaceOn = patch?.surfaceEnabled ?? row.surfaceEnabled;
    const expandedOn = patch?.expandedEnabled ?? row.expandedEnabled;
    await prisma.oddsSportControl.update({
      where: { sport: row.sport },
      data: {
        ...(patch ?? {}),
        // Every stamp is stale from August, so all of them are overdue and
        // would otherwise fire in one undifferentiated wave.
        nextSurfaceRunAt:
          willBeEnabled && surfaceOn
            ? new Date(now.getTime() + (stagger?.surface ?? 20) * 60_000)
            : null,
        nextExpandedRunAt:
          willBeEnabled && expandedOn
            ? new Date(now.getTime() + (stagger?.expanded ?? 45) * 60_000)
            : null,
      },
    });
    touched.push(row.sport);
  }

  const after = await prisma.oddsControlConfig.update({
    where: { id: "primary" },
    data: {
      dailyCreditLimit: DAILY_CREDIT_LIMIT,
      managedSchedulingEnabled: true,
      paused: false,
    },
  });

  await prisma.oddsControlAuditEvent.create({
    data: {
      action: AUDIT_ACTION,
      target: "primary",
      before: {
        managedSchedulingEnabled: config.managedSchedulingEnabled,
        dailyCreditLimit: config.dailyCreditLimit,
        sports: before.map((row) => ({
          sport: row.sport,
          enabled: row.enabled,
          expandedEnabled: row.expandedEnabled,
          expandedMarkets: row.expandedMarkets.length,
          expandedCadenceMinutes: row.expandedCadenceMinutes,
          maxEventsPerRun: row.maxEventsPerRun,
        })),
      },
      after: {
        managedSchedulingEnabled: after.managedSchedulingEnabled,
        dailyCreditLimit: after.dailyCreditLimit,
        updates,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    managedSchedulingEnabled: after.managedSchedulingEnabled,
    dailyCreditLimit: after.dailyCreditLimit,
    sportsTouched: touched,
  });
}
