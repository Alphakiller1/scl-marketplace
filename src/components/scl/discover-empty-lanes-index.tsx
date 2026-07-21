import { useId } from "react";

import {
  DISCOVER_LANE_LOAD_FAILED_BODY,
  DISCOVER_LANE_LOAD_FAILED_TITLE,
  discoverLaneEmptyDescription,
  type DiscoverLaneResult,
} from "@/lib/discover-lanes";
import { cn } from "@/lib/utils";

/**
 * Compact index of empty Discover lanes — disclosures that preserve every
 * honest empty string. Used on mobile always, and on desktop when ≥3 lanes
 * are empty (see discover/page.tsx). Do not nest *filled* lane bodies inside
 * closed <details> (see #212); empty-lane copy is safe here.
 */
export function DiscoverEmptyLanesIndex({
  lanes,
  failed = false,
  className,
}: {
  lanes: DiscoverLaneResult[];
  failed?: boolean;
  className?: string;
}) {
  const headingId = useId();

  if (!lanes.length) return null;

  return (
    <section
      className={cn("space-y-3", className)}
      aria-labelledby={headingId}
      data-visual-mode="rank"
    >
      <div className="min-w-0 border-t border-[color:var(--scl-line)] pt-3">
        <div className="flex items-start gap-3">
          <span
            className="scl-data mt-0.5 shrink-0 text-xs font-semibold text-[color:var(--scl-muted-data)] tabular-nums"
            aria-hidden
          >
            —
          </span>
          <div className="min-w-0">
            <h2
              id={headingId}
              className="scl-display text-base font-bold tracking-[0.04em] sm:text-lg"
            >
              Lanes Without Matches Yet
            </h2>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Expand a lane to read why it is empty. SCL does not invent rows.
            </p>
          </div>
        </div>
      </div>

      <ul className="divide-border border-border divide-y border-y">
        {lanes.map((lane) => {
          const title = failed ? DISCOVER_LANE_LOAD_FAILED_TITLE : lane.empty;
          const description = failed
            ? DISCOVER_LANE_LOAD_FAILED_BODY
            : discoverLaneEmptyDescription(lane.id);

          return (
            <li
              key={lane.id}
              id={`discover-lane-${lane.id}`}
              className="scroll-mt-24"
            >
              <details className="group py-2">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-md px-0.5 text-left outline-none marker:content-none focus-visible:ring-2 focus-visible:ring-[color:var(--scl-blue)] [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    <span className="scl-display text-foreground block text-sm font-bold tracking-[0.04em]">
                      {lane.title}
                    </span>
                    <span className="text-muted-foreground mt-0.5 block truncate text-xs leading-snug">
                      {title}
                    </span>
                  </span>
                  <span
                    className="text-muted-foreground shrink-0 text-xs font-semibold tracking-wide uppercase transition-transform group-open:rotate-180"
                    aria-hidden
                  >
                    ▾
                  </span>
                </summary>
                <div className="text-muted-foreground mt-2 space-y-1.5 pb-1 pl-0.5 text-sm leading-relaxed">
                  <p className="text-foreground font-medium">{title}</p>
                  <p>{description}</p>
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
