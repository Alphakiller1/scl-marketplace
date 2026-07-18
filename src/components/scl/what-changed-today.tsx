import Link from "next/link";
import { Activity } from "lucide-react";

import { RankMovementIndicator } from "@/components/scl/indicators";
import { EmptyState } from "@/components/scl/states";
import { formatRoi, formatUnits } from "@/lib/format";
import type { TodaysMove } from "@/lib/queries/home-live";
import { perfScale, perfToneClass } from "@/lib/perf-scale";
import { cn } from "@/lib/utils";

/**
 * Live strip — real graded moves today (ET). Honest empty at cold start.
 */
export function WhatChangedToday({
  moves,
  failed = false,
  className,
}: {
  moves: TodaysMove[];
  failed?: boolean;
  className?: string;
}) {
  return (
    <section
      className={cn("space-y-3", className)}
      aria-label="What changed today"
    >
      <div className="flex items-center gap-2 border-l-[3px] border-[color:var(--scl-blue)] pl-3">
        <Activity
          className="size-4 shrink-0 text-[color:var(--scl-blue)]"
          aria-hidden
        />
        <div className="min-w-0">
          <h2 className="scl-display text-lg font-semibold tracking-[0.04em]">
            What changed today
          </h2>
          <p className="text-muted-foreground text-xs">
            Graded units today · ET calendar day
          </p>
        </div>
      </div>

      {!moves.length ? (
        <EmptyState
          icon={Activity}
          title={
            failed ? "Couldn't load today's moves" : "No graded moves today"
          }
          description={
            failed
              ? "Try again shortly."
              : "When board-verified picks settle today, unit movers will appear here."
          }
          className="py-6"
        />
      ) : (
        <ul className="border-border bg-card divide-border divide-y overflow-hidden rounded-[14px] border">
          {moves.map((move) => {
            const unitsScale = perfScale("units", move.unitsDelta, {
              gradedCount: move.settledPicks,
            });
            const roiScale = perfScale("roi", move.roi, {
              gradedCount: move.settledPicks,
            });
            return (
              <li key={move.handle}>
                <Link
                  href={`/cappers/${move.handle}`}
                  className="hover:bg-surface-2 focus-visible:ring-ring flex min-h-14 items-center gap-3 px-3 py-2.5 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
                >
                  <RankMovementIndicator delta={move.rankDelta} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    @{move.handle}
                  </span>
                  <span className="text-muted-foreground scl-data shrink-0 text-xs tabular-nums">
                    {move.gradedCount} graded
                  </span>
                  <span
                    className={cn(
                      "scl-data shrink-0 text-sm font-semibold tabular-nums",
                      perfToneClass(roiScale.tone),
                    )}
                    title={roiScale.ariaLabel}
                  >
                    {formatRoi(move.roi)}
                  </span>
                  <span
                    className={cn(
                      "scl-data w-16 shrink-0 text-right text-sm font-bold tabular-nums",
                      perfToneClass(unitsScale.tone),
                    )}
                    title={unitsScale.ariaLabel}
                  >
                    {formatUnits(move.unitsDelta)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
