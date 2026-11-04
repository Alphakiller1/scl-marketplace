import type { StuckPlayRow } from "@/lib/results/stuck-plays";

export type GradingWorkQueueRow = StuckPlayRow & {
  reason: string;
  manualOnly: boolean;
};

/** Manual-only rows take priority; all overdue straight plays and legs remain reachable. */
export function buildGradingWorkQueue(
  manual: (StuckPlayRow & { reason: string })[],
  overdue: StuckPlayRow[],
  legs: StuckPlayRow[],
  take = Number.POSITIVE_INFINITY,
): GradingWorkQueueRow[] {
  const seen = new Set<string>();
  const rows: GradingWorkQueueRow[] = [
    ...manual.map((play) => ({ ...play, manualOnly: true })),
    ...overdue.map((play) => ({
      ...play,
      manualOnly: false,
      reason: `${play.market} is past its expected final for ${play.sport} — automatic retries continue`,
    })),
    ...legs.map((play) => ({
      ...play,
      manualOnly: false,
      reason: `${play.market} parlay leg is past its expected final for ${play.sport} — automatic retries continue`,
    })),
  ];
  return rows
    .filter((play) => {
      if (seen.has(play.id)) return false;
      seen.add(play.id);
      return true;
    })
    .slice(0, take);
}
