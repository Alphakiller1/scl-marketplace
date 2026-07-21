import { RankBoardTable } from "@/components/scl/rank-board-table";
import type { CapperSummary } from "@/lib/mock";

/**
 * Hero Live-board body — Rank-schema density (Units sort).
 * Soft CompactCapperRow is not allowed here.
 */
export function SnapshotBoardTable({
  cappers,
  className,
}: {
  cappers: CapperSummary[];
  className?: string;
}) {
  return (
    <RankBoardTable
      cappers={cappers}
      density="snapshot"
      caption="Leaderboard snapshot ranked by net units."
      className={className}
    />
  );
}
