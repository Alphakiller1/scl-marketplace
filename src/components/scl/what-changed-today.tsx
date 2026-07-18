import Link from "next/link";
import { Activity } from "lucide-react";

import { RankMovementIndicator } from "@/components/scl/indicators";
import { EmptyState } from "@/components/scl/states";
import { formatUnits } from "@/lib/format";
import type { TodaysMove } from "@/lib/queries/home-live";
import { perfScale, perfToneClass } from "@/lib/perf-scale";
import { cn } from "@/lib/utils";

/**
 * Live open strip — graded unit movers today (ET).
 * Hairlines + status rhythm; not a rounded card list.
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Activity
            className="size-4 shrink-0 text-[color:var(--scl-blue)]"
            aria-hidden
          />
          <div className="min-w-0">
            <h2 className="scl-display text-lg font-semibold tracking-[0.04em]">
              What changed today
            </h2>
            <p className="text-muted-foreground text-xs">
              Graded units today · ET calendar day · status rhythm
            </p>
          </div>
        </div>
        <span className="scl-data text-muted-foreground text-[0.65rem] tracking-[0.08em] uppercase">
          Live · ET
        </span>
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
          className="py-5"
        />
      ) : (
        <ul className="border-border divide-border divide-y border-y">
          {moves.map((move) => {
            const unitsScale = perfScale("units", move.unitsDelta, {
              gradedCount: move.settledPicks,
            });
            const status = move.rank > 0 ? `Rank #${move.rank}` : "Building";
            return (
              <li key={move.handle}>
                <Link
                  href={`/cappers/${move.handle}`}
                  className="hover:bg-surface-2/60 focus-visible:ring-ring grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2.5 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset sm:grid-cols-[4.5rem_minmax(0,1fr)_5.5rem_4.5rem_5rem]"
                >
                  <span className="scl-data text-muted-foreground text-[0.65rem] tracking-[0.06em] uppercase tabular-nums">
                    {status}
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    <RankMovementIndicator delta={move.rankDelta} />
                    <span className="truncate text-sm font-semibold">
                      @{move.handle}
                    </span>
                  </span>
                  <span className="text-muted-foreground scl-data hidden text-xs tabular-nums sm:block">
                    {move.gradedCount} graded
                  </span>
                  <span className="text-muted-foreground hidden text-[0.65rem] tracking-[0.06em] uppercase sm:block">
                    Settled
                  </span>
                  <span
                    className={cn(
                      "scl-data justify-self-end text-sm font-bold tabular-nums",
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
