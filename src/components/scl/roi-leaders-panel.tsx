import { Leaderboard } from "@/components/scl/leaderboard";
import type { CapperSummary } from "@/lib/mock";
import { cn } from "@/lib/utils";

/**
 * Homepage ROI leaders — same competitive table chrome as Performance Leaderboard.
 * Rank is position within this ROI-sorted list (not global units rank).
 */
export function RoiLeadersPanel({
  cappers,
  className,
}: {
  cappers: CapperSummary[];
  className?: string;
}) {
  if (cappers.length === 0) return null;

  return (
    <div className={cn("min-w-0", className)}>
      <Leaderboard
        cappers={cappers}
        rankByPosition
        compactMobile
        primaryMetric="roi"
      />
    </div>
  );
}
