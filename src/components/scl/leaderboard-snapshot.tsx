"use client";

import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/scl/states";
import { SnapshotBoardTable } from "@/components/scl/snapshot-board-table";
import { formatUpdatedAgo } from "@/lib/format-freshness";
import type { CapperSummary } from "@/lib/mock";
import { cn } from "@/lib/utils";

/**
 * Homepage Live board — rolling Rank-schema snapshot (ROI sort).
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
  const pageCount = Math.max(1, Math.ceil(cappers.length / limit));
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);
  const safePage = page % pageCount;
  const rankOffset = safePage * limit;
  const rows = cappers.slice(rankOffset, rankOffset + limit);

  useEffect(() => {
    if (paused || pageCount < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = window.setInterval(
      () => setPage((current) => (current + 1) % pageCount),
      6500,
    );
    return () => window.clearInterval(id);
  }, [pageCount, paused]);

  return (
    <section
      className={cn("space-y-2.5 sm:space-y-4", className)}
      aria-label="Leaderboard Snapshot"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      <div className="flex flex-wrap items-end justify-between gap-2 sm:gap-4">
        <div className="scl-section-mark min-w-0">
          <p className="scl-eyebrow">Live Board</p>
          <h2 className="scl-display mt-1 text-[1.25rem] leading-7 font-semibold tracking-[0.02em] normal-case sm:mt-1.5 sm:text-[1.375rem]">
            Leaderboard Snapshot
          </h2>
          <p className="text-muted-foreground mt-1 text-xs leading-snug sm:mt-1.5 sm:text-sm sm:leading-relaxed">
            90-Day Board Standings — Ranked By ROI
          </p>
          <p className="text-muted-foreground mt-1 text-[0.68rem] leading-snug">
            Rankings update after game results are graded.
          </p>
          <p className="scl-data text-muted-foreground mt-1 text-[0.65rem] tabular-nums sm:mt-1.5 sm:text-[0.7rem]">
            {formatUpdatedAgo(updatedAt)}
          </p>
        </div>
        <Link
          href="/leaderboard?window=90d&sort=roi&dir=desc"
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
        <div key={safePage} className="scl-board-fade-in">
          <SnapshotBoardTable cappers={rows} rankOffset={rankOffset} />
        </div>
      )}

      {pageCount > 1 ? (
        <div
          className="flex items-center justify-center gap-2"
          aria-label="Leaderboard snapshot pages"
        >
          {Array.from({ length: pageCount }, (_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Show ROI ranks ${index * limit + 1} through ${Math.min((index + 1) * limit, cappers.length)}`}
              aria-current={safePage === index ? "true" : undefined}
              onClick={() => setPage(index)}
              className={cn(
                "focus-visible:ring-ring h-2 rounded-full transition-[width,background-color] focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none",
                safePage === index
                  ? "w-6 bg-[color:var(--scl-blue)]"
                  : "w-2 bg-[color:var(--scl-muted-label)] hover:bg-[color:var(--scl-muted-data)]",
              )}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
