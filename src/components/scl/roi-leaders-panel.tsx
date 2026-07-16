import Link from "next/link";

import { CompactCapperRow } from "@/components/scl/compact-capper-row";
import type { CapperSummary } from "@/lib/mock";
import { cn } from "@/lib/utils";

/** Homepage ROI leaders — horizontal snap on mobile, compact list on md+. */
export function RoiLeadersPanel({
  cappers,
  className,
}: {
  cappers: CapperSummary[];
  className?: string;
}) {
  if (cappers.length === 0) return null;

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex [scrollbar-width:none] gap-3 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] md:hidden [&::-webkit-scrollbar]:hidden">
        {cappers.map((capper, index) => (
          <div
            key={capper.id}
            className="w-[min(82vw,18rem)] shrink-0 snap-start"
          >
            <CompactCapperRow
              capper={capper}
              rank={index + 1}
              primaryMetric="roi"
            />
          </div>
        ))}
      </div>

      <div className="border-border bg-card hidden overflow-hidden rounded-xl border md:block">
        <div className="divide-border divide-y">
          {cappers.map((capper, index) => (
            <RoiLeaderRow key={capper.id} capper={capper} rank={index + 1} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RoiLeaderRow({
  capper,
  rank,
}: {
  capper: CapperSummary;
  rank: number;
}) {
  return (
    <Link
      href={`/cappers/${capper.handle}`}
      className="hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:ring-ring grid min-h-14 grid-cols-[2.5rem_minmax(0,1fr)_5rem_5rem_4.5rem] items-center gap-3 px-3 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
    >
      <span className="text-muted-foreground text-sm font-bold tabular-nums">
        #{rank}
      </span>
      <span className="truncate font-semibold">@{capper.handle}</span>
      <span className="text-right text-sm tabular-nums">
        {capper.roi.toFixed(1)}%
      </span>
      <span className="text-right text-sm tabular-nums">
        {capper.units.toFixed(1)}u
      </span>
      <span className="text-muted-foreground text-right text-xs tabular-nums">
        {capper.settledPicks ?? 0} graded
      </span>
    </Link>
  );
}
