import "server-only";

import { profitUnitsForOutcome } from "@/lib/odds";
import { prisma } from "@/lib/prisma";
import { resolveOutcome } from "@/lib/results/match";
import type { ResultsProvider } from "@/lib/results/provider";

export type AutoGradeResult = {
  graded: number;
  skipped: number;
  provider: string;
};

/**
 * Grade every confidently-resolvable pending play from settled results.
 * Unmatched plays stay PENDING (admin fallback). Writes an append-only AUTO audit
 * per graded play and derives P/L from the play's odds + units.
 */
export async function autoGradePending(
  provider: ResultsProvider,
): Promise<AutoGradeResult> {
  const pending = (
    await prisma.play.findMany({
      where: { outcome: "PENDING", parlayId: null },
      select: {
        id: true,
        sport: true,
        market: true,
        selection: true,
        oddsAmerican: true,
        units: true,
      },
      take: 500,
    })
  ).map((p) => ({ ...p, units: Number(p.units) }));

  if (pending.length === 0)
    return { graded: 0, skipped: 0, provider: provider.name };

  const games = await provider.fetchSettled();
  let graded = 0;
  let skipped = 0;

  for (const play of pending) {
    const outcome = resolveOutcome(play, games);
    if (!outcome) {
      skipped++;
      continue;
    }
    const profitUnits = profitUnitsForOutcome(
      outcome,
      play.oddsAmerican,
      play.units,
    );
    await prisma.$transaction([
      prisma.play.update({
        where: { id: play.id },
        data: { outcome, profitUnits, gradedAt: new Date() },
      }),
      prisma.gradingAudit.create({
        data: {
          playId: play.id,
          previousOutcome: "PENDING",
          newOutcome: outcome,
          source: "AUTO",
          gradedById: null,
          reason: `Auto-graded from ${provider.name} settled results`,
        },
      }),
    ]);
    graded++;
  }

  return { graded, skipped, provider: provider.name };
}
