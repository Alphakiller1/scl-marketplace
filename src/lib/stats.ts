import type { Outcome } from "@prisma/client";

export type PlayForStats = {
  outcome: Outcome;
  units: number;
  profitUnits: number | null;
};

export type CapperStats = {
  wins: number;
  losses: number;
  pushes: number;
  pending: number;
  settled: number;
  stakedUnits: number;
  winPct: number;
  units: number; // net profit in units
  roi: number; // %
};

/**
 * Derive a capper's headline stats from their plays. Void plays are excluded
 * from the record and ROI (stake returned); pending plays count only as pending.
 * Win% is wins / (wins + losses); ROI is net profit / total staked on settled.
 */
export function computeCapperStats(plays: PlayForStats[]): CapperStats {
  let wins = 0;
  let losses = 0;
  let pushes = 0;
  let pending = 0;
  let staked = 0;
  let profit = 0;

  for (const p of plays) {
    switch (p.outcome) {
      case "WIN":
        wins++;
        break;
      case "LOSS":
        losses++;
        break;
      case "PUSH":
        pushes++;
        break;
      case "PENDING":
        pending++;
        continue;
      case "VOID":
        continue;
    }
    staked += p.units;
    profit += p.profitUnits ?? 0;
  }

  const decided = wins + losses;
  return {
    wins,
    losses,
    pushes,
    pending,
    settled: wins + losses + pushes,
    stakedUnits: staked,
    winPct: decided > 0 ? (wins / decided) * 100 : 0,
    units: profit,
    roi: staked > 0 ? (profit / staked) * 100 : 0,
  };
}
