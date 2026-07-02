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

export type SportStats = CapperStats & { sport: string };

/**
 * Per-sport performance breakdown, best (most units) first. Sports without a
 * settled play are dropped so the dashboard only shows real results.
 */
export function computeStatsBySport(
  plays: (PlayForStats & { sport: string })[],
): SportStats[] {
  const grouped = new Map<string, (PlayForStats & { sport: string })[]>();
  for (const p of plays) {
    const arr = grouped.get(p.sport);
    if (arr) arr.push(p);
    else grouped.set(p.sport, [p]);
  }
  return [...grouped.entries()]
    .map(([sport, rows]) => ({ sport, ...computeCapperStats(rows) }))
    .filter((s) => s.settled > 0)
    .sort((a, b) => b.units - a.units);
}

/** Stats over a trailing window (e.g. last 30 days), by play creation time. */
export function computeStatsSince(
  plays: (PlayForStats & { createdAt: Date })[],
  since: Date,
): CapperStats {
  return computeCapperStats(plays.filter((p) => p.createdAt >= since));
}

/** A Date `days` before `from` (default now) — for trailing-window stats. */
export function daysAgo(days: number, from: Date = new Date()): Date {
  return new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
}
