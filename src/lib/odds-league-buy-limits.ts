import "server-only";

import { DEFAULT_EVENT_BUYS_PER_DAY } from "@/lib/odds-event-buy-budget";
import { prisma } from "@/lib/prisma";

/**
 * Per-league daily verification allowances, read so that a missing column is
 * never an outage.
 *
 * `OddsSportControl.dailyVerificationLimit` ships in a migration that is applied
 * by hand — no CI runner can reach this database, and the build deliberately
 * runs no DB operations. So the code WILL be live against a schema that does not
 * have this column yet, and the read has to survive that.
 *
 * It is deliberately the only place the column is touched. Reading it inside the
 * ordinary `findUnique`/`findMany` calls would have meant a missing column
 * taking down the admin dashboard and, worse, the on-demand event board that
 * pick entry depends on — Prisma selects every scalar field unless told
 * otherwise, so one absent column fails the whole query.
 *
 * Degrading to the shared default is the safe direction: a league whose
 * allowance cannot be read is capped at {@link DEFAULT_EVENT_BUYS_PER_DAY}
 * rather than left uncapped.
 */
export async function loadLeagueBuyLimits(): Promise<Map<string, number>> {
  try {
    const rows = await prisma.oddsSportControl.findMany({
      select: { sport: true, dailyVerificationLimit: true },
    });
    return new Map(rows.map((row) => [row.sport, row.dailyVerificationLimit]));
  } catch (error) {
    // Any failure here — missing table, missing column, unreachable database —
    // means "use the default", never "no limit".
    console.warn("[odds] league buy limits unavailable; using the default", {
      reason: error instanceof Error ? error.message : String(error),
    });
    return new Map();
  }
}

/** One league's allowance, falling back to the shared default. */
export async function leagueBuyLimit(sport: string): Promise<number> {
  const limits = await loadLeagueBuyLimits();
  return limits.get(sport.trim().toUpperCase()) ?? DEFAULT_EVENT_BUYS_PER_DAY;
}
