import type { Outcome } from "@prisma/client";

import { settleParlay } from "@/lib/grading";
import { profitUnitsForOutcome } from "@/lib/odds";

export type SettlementSnapshot = {
  outcome: Outcome;
  profitUnits: number | null;
};

export function profitUnitsEqual(
  left: number | null,
  right: number | null,
): boolean {
  if (left == null || right == null) return left === right;
  return Math.round(left * 100) === Math.round(right * 100);
}

export function settlementChanged(
  before: SettlementSnapshot,
  after: SettlementSnapshot,
): boolean {
  return (
    before.outcome !== after.outcome ||
    !profitUnitsEqual(before.profitUnits, after.profitUnits)
  );
}

export function previewStraightCorrection(input: {
  current: SettlementSnapshot;
  nextOutcome: Exclude<Outcome, "PENDING">;
  oddsAmerican: number;
  units: number;
}) {
  const after: SettlementSnapshot = {
    outcome: input.nextOutcome,
    profitUnits: profitUnitsForOutcome(
      input.nextOutcome,
      input.oddsAmerican,
      input.units,
    ),
  };

  return {
    before: input.current,
    after,
    changed: settlementChanged(input.current, after),
  };
}

export function previewParlayCorrection(input: {
  current: SettlementSnapshot;
  units: number;
  legs: {
    id: string;
    outcome: Outcome;
    oddsAmerican: number;
  }[];
  nextOutcomes: Record<string, Outcome>;
}) {
  const changedLegCount = input.legs.filter(
    (leg) => input.nextOutcomes[leg.id] !== leg.outcome,
  ).length;
  const settlement = settleParlay(
    input.legs.map((leg) => ({
      outcome: input.nextOutcomes[leg.id] ?? leg.outcome,
      oddsAmerican: leg.oddsAmerican,
    })),
    input.units,
  );
  const after: SettlementSnapshot = {
    outcome: settlement.outcome,
    profitUnits: settlement.profitUnits,
  };

  return {
    before: input.current,
    after,
    changedLegCount,
    changed: changedLegCount > 0 || settlementChanged(input.current, after),
    effectiveOddsAmerican: settlement.effectiveOddsAmerican,
  };
}
