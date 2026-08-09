import { RankBoardTable } from "@/components/scl/rank-board-table";
import type { CapperSummary } from "@/lib/mock";

/**
 * Hero Live-board body — Rank-schema density (ROI sort).
 * Soft CompactCapperRow is not allowed here.
 */
export function SnapshotBoardTable({
  cappers,
  rankOffset = 0,
  className,
}: {
  cappers: CapperSummary[];
  rankOffset?: number;
  className?: string;
}) {
  return (
    <RankBoardTable
      cappers={cappers}
      density="snapshot"
      caption="Leaderboard Snapshot Ranked By ROI."
      rankOffset={rankOffset}
      className={className}
    />
  );
}
