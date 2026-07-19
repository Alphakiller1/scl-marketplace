import { Compass, Users } from "lucide-react";

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
  failed = false,
  className,
}: {
  lane: DiscoverLaneResult;
  failed?: boolean;
  className?: string;
}) {
  return (
    <section
      className={cn("space-y-3", className)}
      aria-labelledby={`discover-lane-${lane.id}`}
      data-visual-mode="rank"
    >
      <div className="min-w-0 border-t border-[color:var(--scl-line)] pt-3">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="flex min-w-0 items-start gap-2">
            <Compass
              className="mt-0.5 size-4 shrink-0 text-[color:var(--scl-blue)]"
              aria-hidden
            />
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
              <dt className="scl-eyebrow text-[color:var(--scl-muted-label)]">
                Primary measure
              </dt>
              <dd className="scl-data mt-0.5 text-sm font-bold">
                {lane.primaryLabel}
              </dd>
            </div>
            {lane.entries.length ? (
              <div className="border-l border-[color:var(--scl-line)] pl-4 text-right">
                <dt className="scl-eyebrow text-[color:var(--scl-muted-label)]">
                  Preview
                </dt>
                <dd className="scl-data mt-0.5 text-sm font-bold tabular-nums">
                  {lane.entries.length} shown
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
        <ul className="divide-border border-border divide-y border-y">
          {lane.entries.map((entry) => (
            <li key={`${lane.id}-${entry.capper.id}`}>
              <DiscoverLaneCard entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
