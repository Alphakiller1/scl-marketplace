import { Users } from "lucide-react";

import { DiscoverLaneCard } from "@/components/scl/discover-lane-card";
import { EmptyState } from "@/components/scl/states";
import {
  DISCOVER_LANE_LOAD_FAILED_BODY,
  DISCOVER_LANE_LOAD_FAILED_TITLE,
  discoverLaneEmptyDescription,
  type DiscoverLaneResult,
} from "@/lib/discover-lanes";
import { cn } from "@/lib/utils";

/**
 * Rank/Live Discover lane — scannable strip, not a card-wall.
 */
export function DiscoverLaneSection({
  lane,
  index,
  failed = false,
  className,
}: {
  lane: DiscoverLaneResult;
  index: number;
  failed?: boolean;
  className?: string;
}) {
  return (
    <section
      className={cn("space-y-3", className)}
      aria-labelledby={`discover-lane-${lane.id}`}
      data-visual-mode="rank"
    >
      <div className="scl-section-mark min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="scl-data mt-0.5 shrink-0 text-xs font-semibold text-[color:var(--scl-pink-text)] tabular-nums"
              aria-hidden
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <h2
                id={`discover-lane-${lane.id}`}
                className="scl-display scroll-mt-24 text-base font-bold tracking-[0.04em] sm:text-lg"
              >
                {lane.title}
              </h2>
              <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-relaxed">
                {lane.explainer}
              </p>
            </div>
          </div>
          <dl className="flex shrink-0 items-center gap-4 pl-6 sm:pl-0">
            <div>
              <dt className="scl-eyebrow text-[color:var(--scl-muted-data)]">
                Primary Measure
              </dt>
              <dd className="scl-data mt-0.5 text-sm font-bold">
                {lane.primaryLabel}
              </dd>
            </div>
            {lane.entries.length ? (
              <div className="border-l border-[color:var(--scl-line)] pl-4 text-right">
                <dt className="scl-eyebrow text-[color:var(--scl-muted-data)]">
                  Preview
                </dt>
                <dd className="scl-data mt-0.5 text-sm font-bold tabular-nums">
                  {lane.entries.length} Shown
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>

      {!lane.entries.length ? (
        <EmptyState
          icon={Users}
          title={failed ? DISCOVER_LANE_LOAD_FAILED_TITLE : lane.empty}
          description={
            failed
              ? DISCOVER_LANE_LOAD_FAILED_BODY
              : discoverLaneEmptyDescription(lane.id)
          }
        />
      ) : (
        <ul className="divide-border border-border scl-elevated divide-y overflow-hidden rounded-[14px] border">
          {lane.entries.map((entry) => (
            <li key={`${lane.id}-${entry.capper.id}`} className="px-3 sm:px-4">
              <DiscoverLaneCard entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
