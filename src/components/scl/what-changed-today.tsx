import Link from "next/link";
import { Activity } from "lucide-react";

import { RankMovementIndicator } from "@/components/scl/indicators";
import { formatUnits } from "@/lib/format";
import type { TodaysMove } from "@/lib/queries/home-live";
import { perfScale, perfToneClass } from "@/lib/perf-scale";
import { cn } from "@/lib/utils";

/**
 * Design-layer ticker under the hero — one thin strip, never a second board.
 * Empty compresses to a single open line; populated = horizontal pulse chips.
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
  if (!moves.length) {
    return (
      <section className={cn(className)} aria-label="What Changed Today">
        <p
          className="text-muted-foreground flex min-h-12 items-center gap-2.5 py-3.5 text-sm leading-relaxed"
          role="status"
        >
          <Activity
            className="size-3.5 shrink-0 text-[color:var(--scl-blue)]"
            aria-hidden
          />
          <span className="min-w-0">
            <span className="text-foreground font-medium">
              {failed
                ? "Couldn't Load Today's Moves"
                : "No Graded Changes Today."}
            </span>
            {failed ? (
              <span> Try Again Shortly.</span>
            ) : (
              <span>
                {" "}
                Rank And Unit Changes Appear After Board-Verified Picks Are
                Graded.
              </span>
            )}
          </span>
        </p>
      </section>
    );
  }

  return (
    <section
      className={cn("py-3.5", className)}
      aria-label="What Changed Today"
    >
      <div className="flex min-h-12 items-center gap-3 overflow-hidden">
        <div className="flex shrink-0 items-center gap-2">
          <Activity
            className="size-3.5 shrink-0 text-[color:var(--scl-blue)]"
            aria-hidden
          />
          <p className="scl-display text-sm font-semibold tracking-[0.02em] normal-case">
            What Changed Today
          </p>
        </div>

        <ul className="flex min-w-0 flex-1 [scrollbar-width:none] items-center gap-2 overflow-x-auto py-0.5 [&::-webkit-scrollbar]:hidden">
          {moves.slice(0, 10).map((move) => {
            const unitsScale = perfScale("units", move.unitsDelta, {
              gradedCount: move.settledPicks,
            });
            const status = move.rank > 0 ? `#${move.rank}` : "Building";
            return (
              <li key={move.handle} className="shrink-0">
                <Link
                  href={`/cappers/${move.handle}`}
                  className="border-border focus-visible:ring-ring inline-flex h-8 items-center gap-2 rounded-[var(--scl-radius-chip)] border bg-[color:var(--scl-ink-800)] px-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] hover:bg-[color:var(--scl-ink-700)] focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className="scl-data text-muted-foreground text-[0.65rem] tracking-[0.06em] uppercase tabular-nums">
                    {status}
                  </span>
                  <RankMovementIndicator delta={move.rankDelta} />
                  <span className="text-sm font-semibold">@{move.handle}</span>
                  <span
                    className={cn(
                      "scl-data text-sm font-bold tabular-nums",
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

        <span className="scl-data text-muted-foreground hidden shrink-0 text-[0.65rem] tracking-[0.08em] uppercase sm:inline">
          Today · ET
        </span>
      </div>
    </section>
  );
}
