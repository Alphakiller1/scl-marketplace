import "server-only";

import { UNIT_MIN } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { prismaExcludeTestHandles } from "@/lib/public-eligibility";

const LAG_HOURS = 2;
const UNHEALTHY_LAGGING_PLAYS = 3;

/**
 * Grading pipeline health for public honesty copy.
 * Unhealthy when ≥3 public-eligible pending plays are 2h+ past event start.
 */
export async function getGradingHealth(): Promise<boolean> {
  const now = new Date();
  const lagBefore = new Date(now.getTime() - LAG_HOURS * 60 * 60 * 1000);

  const lagging = await prisma.play.count({
    where: {
      outcome: "PENDING",
      eventStartsAt: { not: null, lt: lagBefore },
      units: { gte: UNIT_MIN },
      capper: {
        user: {
          accountStatus: "ACTIVE",
          username: { not: null },
          ...prismaExcludeTestHandles(),
        },
      },
    },
  });

  return lagging < UNHEALTHY_LAGGING_PLAYS;
}
