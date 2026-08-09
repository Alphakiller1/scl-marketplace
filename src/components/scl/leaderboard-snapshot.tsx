"use client";

import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/scl/states";
import { SnapshotBoardTable } from "@/components/scl/snapshot-board-table";
import { formatUpdatedAgo } from "@/lib/format-freshness";
import type { CapperSummary } from "@/lib/mock";
import { cn } from "@/lib/utils";

type SnapshotBoard = {
  id: "1d" | "7d" | "14d";
  label: string;
  cappers: CapperSummary[];
  failed?: boolean;
};

/** Homepage live board that rolls through short ROI windows without navigation. */
export function LeaderboardSnapshot({
  boards,
  updatedAt,
  limit = 5,
  className,
}: {
  boards: SnapshotBoard[];
  updatedAt: Date;
  limit?: number;
  className?: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeBoard = boards[activeIndex] ?? boards[0];
  const rows = activeBoard?.cappers.slice(0, limit) ?? [];

  useEffect(() => {
    if (boards.length < 2) return;
    const interval = window.setInterval(
      () => setActiveIndex((current) => (current + 1) % boards.length),
      5000,
    );
    return () => window.clearInterval(interval);
  }, [boards.length]);

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
            {activeBoard?.label ?? "Last 1 Day"} - Ranked By ROI%
          </p>
          <p className="text-muted-foreground mt-1 text-[0.68rem] leading-snug">
            Rotates every 5 seconds. Rankings update after results are graded.
          </p>
          <p className="scl-data text-muted-foreground mt-1 text-[0.65rem] tabular-nums sm:mt-1.5 sm:text-[0.7rem]">
            {formatUpdatedAgo(updatedAt)}
          </p>
        </div>
        <Link
          href={`/leaderboard?window=${activeBoard?.id ?? "1d"}&sort=roi`}
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
            activeBoard?.failed
              ? "Couldn't Load The Leaderboard"
              : "No Ranked Cappers Yet"
          }
          description={
            activeBoard?.failed
              ? "Performance Data Is Temporarily Unavailable. Please Try Again Shortly."
              : "Cappers appear here after they have graded picks in the selected window."
          }
        />
      ) : (
        <SnapshotBoardTable cappers={rows} />
      )}
    </section>
  );
}
