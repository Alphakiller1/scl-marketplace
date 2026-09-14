import "server-only";

import type { Prisma } from "@prisma/client";

export const SUPERMAX_DAILY_ERROR =
  "Only one 20u Supermax bet is allowed per day.";

/**
 * Serializes all pick writes for one capper. The legacy key name is retained
 * so straight submissions already using this lock coordinate with parlays.
 */
export async function lockCapperPickSubmission(
  tx: Prisma.TransactionClient,
  capperId: string,
): Promise<void> {
  // Put the void-returning lock function in FROM so Prisma only has to
  // deserialize the supported integer projection.
  await tx.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtext(${`straight-exposure:${capperId}`}))`;
}

/** Shared straight/parlay daily lookup. Call only while holding the lock above. */
export async function hasSupermaxForDay(
  tx: Prisma.TransactionClient,
  capperId: string,
  supermaxDay: Date,
): Promise<boolean> {
  const straight = await tx.play.findFirst({
    where: { capperId, supermaxDay },
    select: { id: true },
  });
  if (straight) return true;

  const parlay = await tx.parlay.findFirst({
    where: { capperId, supermaxDay },
    select: { id: true },
  });
  return parlay != null;
}
