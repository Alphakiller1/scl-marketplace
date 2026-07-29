import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";

import { EmptyState } from "@/components/scl/states";
import { SnapshotBoardTable } from "@/components/scl/snapshot-board-table";
import { formatUpdatedAgo } from "@/lib/format-freshness";
import type { CapperSummary } from "@/lib/mock";
import { cn } from "@/lib/utils";

/**
 * Homepage Live board — Rank-schema dense snapshot (Units sort).
 * Design layer: table anatomy, not CompactCapperRow résumé cards.
 */
export function LeaderboardSnapshot({
  cappers,
  failed = false,
  updatedAt,
  limit = 5,
  className,
}: {
  cappers: CapperSummary[];
  failed?: boolean;
  updatedAt: Date;
  limit?: number;
  className?: string;
}) {
  const rows = cappers.slice(0, limit);

  return (
    <section
      className={cn("space-y-2.5 sm:space-y-4", className)}
      aria-label="Leaderboard Snapshot"
    >
      <div className="flex flex-wrap items-end justify-between gap-2 sm:gap-4">
        <div className="scl-section-mark min-w-0">
          <p className="scl-eyebrow">Live Board</p>
          <h2 className="scl-display mt-1 text-[1.25rem] leading-7 font-semibold tracking-[0.02em] normal-case sm:mt-1.5 sm:text-[1.375rem]">
            Leaderboard Snapshot
          </h2>
          <p className="text-muted-foreground mt-1 text-xs leading-snug sm:mt-1.5 sm:text-sm sm:leading-relaxed">
            Board Standings — Ranked By Net Units
          </p>
          <p className="scl-data text-muted-foreground mt-1 text-[0.65rem] tabular-nums sm:mt-1.5 sm:text-[0.7rem]">
            {formatUpdatedAgo(updatedAt)}
          </p>
        </div>
        <Link
          href="/leaderboard"
          className="scl-link inline-flex min-h-10 shrink-0 items-center gap-1 text-sm font-medium"
        >
          View Full Leaderboard
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          className="py-6 sm:py-7"
          icon={Trophy}
          title={
            failed ? "Couldn't Load The Leaderboard" : "No Ranked Cappers Yet"
          }
          description={
            failed
              ? "Performance Data Is Temporarily Unavailable. Please Try Again Shortly."
              : "Cappers Appear Here After Meeting The Minimum Graded Sample And Verification Filters. Earlier Records Remain Visible Under Building A Record."
          }
        />
      ) : (
        <SnapshotBoardTable cappers={rows} />
      )}
    </section>
  );
}
