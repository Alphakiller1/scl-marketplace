import { PrismaClient } from "@prisma/client";

/**
 * One-shot handover of odds population to the owner-managed scheduler.
 *
 * `OddsControlConfig.managedSchedulingEnabled` has been false since the control
 * plane shipped, which made the whole thing inert: `claimDueOddsRuns` returned
 * "disabled" (so `OddsApiRun` never recorded a single run in its history), and
 * `getManagedOddsSportControl` returned null (so the entry board applied no
 * owner market filtering either). Everything was actually bought by the fixed
 * cron list in vercel.json, which is why the dashboard looked dead while odds
 * kept arriving. `/api/cron/odds-populate` already stands down for unmanaged
 * callers once the flag is on, so this is a handover, not a second buyer.
 *
 * The sport rows have to be correct BEFORE the flag flips, because from that
 * moment the config IS the schedule:
 *
 *  - NFL gains the expanded board the owners specified: halves plus nine player
 *    prop markets and their alternate ladders, bought once per event inside the
 *    pre-kickoff window.
 *  - MMA and CFL are enabled. Cappers posted 35 and 7 plays in the last
 *    fortnight and both rows read `enabled: false`, so they would have gone
 *    dark the moment the crons stood down.
 *  - MLB and WNBA are right-sized. `estimatedRunCredits` reserves
 *    markets x maxEventsPerRun, so a 20-event ceiling on a 15-game slate
 *    over-reserves by a third and blocks other sports for no reason. MLB spent
 *    3,173 of the 3,250 daily cap the day before this ran.
 *  - Every `nextRunAt` is restamped. They are stale from August, so all of them
 *    are overdue and would otherwise fire in one undifferentiated wave.
 *
 * IDEMPOTENT AND ONE-SHOT. The audit row it writes is also its guard: on any
 * later run it finds that row and exits without touching a thing, so a redeploy
 * or a re-dispatch can never overwrite settings the owners have since changed
 * in the dashboard. `--force` overrides that, and `--dry-run` prints the plan.
 */

const FORCE = process.argv.includes("--force");
const DRY_RUN = process.argv.includes("--dry-run");

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

/**
 * The football card the owners asked for: halves, then the passer, runner,
 * receiver and kicker props, each with its alternate ladder.
 *
 * Must stay in step with `expandedBoardMarkets("NFL")` — the populate route
 * filters what it is handed through `allowedExpandedMarkets`, so a key that has
 * drifted out of the code is silently dropped rather than fetched. Written out
 * rather than imported because this runs under tsx on a CI runner, outside the
 * Next path aliases.
 *
 * Anytime TD is deliberately absent: it is Yes/No with no `point`, and the
 * board discards a selection without a line, so it needs lineless support on
 * the board and in grading before it can be requested.
 */
const NFL_EXPANDED_MARKETS = [
  "h2h_h1",
  "spreads_h1",
  "alternate_spreads_h1",
  "totals_h1",
  "alternate_totals_h1",
  "h2h_h2",
  "spreads_h2",
  "alternate_spreads_h2",
  "totals_h2",
  "alternate_totals_h2",
  "player_pass_yds",
  "player_pass_yds_alternate",
  "player_pass_attempts",
  "player_pass_attempts_alternate",
  "player_pass_tds",
  "player_pass_tds_alternate",
  "player_rush_yds",
  "player_rush_yds_alternate",
  "player_rush_attempts",
  "player_rush_attempts_alternate",
  "player_receptions",
  "player_receptions_alternate",
  "player_reception_yds",
  "player_reception_yds_alternate",
  "player_rush_reception_yds",
  "player_rush_reception_yds_alternate",
  "player_field_goals",
  "player_field_goals_alternate",
];

type SportPatch = {
  enabled?: boolean;
  surfaceEnabled?: boolean;
  expandedEnabled?: boolean;
  expandedMarkets?: string[];
  expandedCadenceMinutes?: number;
  maxEventsPerRun?: number;
};

const SPORT_UPDATES: Record<string, SportPatch> = {
  NFL: {
    enabled: true,
    surfaceEnabled: true,
    expandedEnabled: true,
    expandedMarkets: NFL_EXPANDED_MARKETS,
    expandedCadenceMinutes: 360,
    maxEventsPerRun: 16,
  },
  MMA: { enabled: true, surfaceEnabled: true },
  CFL: { enabled: true, surfaceEnabled: true },
  MLB: { expandedCadenceMinutes: 720, maxEventsPerRun: 15 },
  WNBA: { expandedCadenceMinutes: 720, maxEventsPerRun: 12 },
};

/**
 * 3,250 left no room: the day before this ran, the board spent 3,658 with MLB
 * alone taking 3,173. Nudged to 3,400, which is also the month's sustainable
 * pace (74,192 credits over the 22 remaining days). The monthly limit stays the
 * real guardrail.
 */
const DAILY_CREDIT_LIMIT = 3400;

async function main() {
  if (process.env.VERCEL_ENV !== "production") {
    throw new Error("This provisioning script only runs for production.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const prisma = new PrismaClient();
  const now = new Date();

  try {
    const applied = await prisma.oddsControlAuditEvent.findFirst({
      where: { action: AUDIT_ACTION },
      orderBy: { createdAt: "desc" },
    });
    if (applied && !FORCE) {
      console.log(
        `Already applied at ${applied.createdAt.toISOString()} — nothing to do. Re-run with --force only to deliberately overwrite the owners' current settings.`,
      );
      return;
    }

    const config = await prisma.oddsControlConfig.findUnique({
      where: { id: "primary" },
    });
    if (!config) throw new Error("No OddsControlConfig row — nothing to flip.");

    const before = await prisma.oddsSportControl.findMany({
      orderBy: { sport: "asc" },
    });

    console.log(
      `managedSchedulingEnabled=${config.managedSchedulingEnabled} paused=${config.paused} dailyCreditLimit=${config.dailyCreditLimit}`,
    );
    for (const row of before) {
      console.log(
        `  ${row.sport.padEnd(6)} enabled=${row.enabled} surface=${row.surfaceEnabled} expanded=${row.expandedEnabled} mkts=${row.expandedMarkets.length} cadence=${row.expandedCadenceMinutes} maxEvents=${row.maxEventsPerRun}`,
      );
    }

    if (DRY_RUN) {
      console.log("\n--dry-run: would apply");
      for (const [sport, patch] of Object.entries(SPORT_UPDATES)) {
        console.log(`  ${sport}: ${JSON.stringify(patch)}`);
      }
      console.log(`  dailyCreditLimit=${DAILY_CREDIT_LIMIT}`);
      console.log("  managedSchedulingEnabled=true (last)");
      return;
    }

    // Sport rows first. The flag moves last so the scheduler never observes a
    // half-configured slate.
    for (const row of before) {
      const patch = SPORT_UPDATES[row.sport];
      const stagger = STAGGER[row.sport];
      const willBeEnabled = patch?.enabled ?? row.enabled;
      if (!patch && !willBeEnabled) continue;

      const surfaceOn = patch?.surfaceEnabled ?? row.surfaceEnabled;
      const expandedOn = patch?.expandedEnabled ?? row.expandedEnabled;
      await prisma.oddsSportControl.update({
        where: { sport: row.sport },
        data: {
          ...(patch ?? {}),
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
      console.log(
        `  ${row.sport}: ${patch ? "updated" : "schedule restamped"}`,
      );
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
          updates: SPORT_UPDATES,
        },
      },
    });

    console.log(
      `\nmanagedSchedulingEnabled=true, dailyCreditLimit=${after.dailyCreditLimit}. The dispatcher runs every 5 minutes and claims 2 runs a tick.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
