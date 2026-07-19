import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";

import { Leaderboard } from "@/components/scl/leaderboard";
import { EmptyState } from "@/components/scl/states";
import { formatUpdatedAgo } from "@/lib/format-freshness";
import type { CapperSummary } from "@/lib/mock";
import { cn } from "@/lib/utils";

/**
 * Homepage Live — compact leaderboard snapshot (Units, never dollar handle).
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
  return (
    <section
      className={cn("space-y-3", className)}
      aria-label="Leaderboard snapshot"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 border-t border-[color:var(--scl-pink-deep)] pt-2.5">
          <p className="scl-eyebrow">Live board</p>
          <h2 className="scl-display text-lg font-semibold tracking-[0.04em]">
            Leaderboard snapshot
          </h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Board standings — ranked by net units
          </p>
          <p className="scl-data text-muted-foreground mt-0.5 text-xs tabular-nums">
            {formatUpdatedAgo(updatedAt)}
          </p>
        </div>
        <Link
          href="/leaderboard"
          className="scl-link inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium"
        >
          View full leaderboard
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      {cappers.length === 0 ? (
        <EmptyState
          className="py-6 sm:py-7"
          icon={Trophy}
          title={
            failed ? "Couldn't load the leaderboard" : "No ranked cappers yet"
          }
          description={
            failed
              ? "Performance data is temporarily unavailable. Please try again shortly."
              : "Cappers appear here after meeting the minimum graded sample and verification filters. Earlier records remain visible under Building a Record."
          }
        />
      ) : (
        <Leaderboard
          cappers={cappers}
          limit={limit}
          failed={failed}
          compactMobile
          compactDesktop
          flush
          primaryMetric="units"
          emptyDescription="The founding roster is forming. Verified cappers will appear here after they clear SCL’s ranking sample."
        />
      )}
    </section>
  );
}
