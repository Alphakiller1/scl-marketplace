import Link from "next/link";

import { CapperAvatar } from "@/components/scl/capper-avatar";
import { SportTag, VerificationBadge } from "@/components/scl/badges";
import { RankBadge } from "@/components/scl/rank-badge";
import { cn } from "@/lib/utils";
import { formatRecord, formatRoi, formatUnits, signTone } from "@/lib/format";
import type { CapperSummary } from "@/lib/mock";

const toneText = {
  pos: "text-pos",
  neg: "text-neg",
  muted: "text-foreground",
};

export function RankingRail({
  cappers,
  metric,
}: {
  cappers: CapperSummary[];
  metric: "units" | "roi";
}) {
  return (
    <ol className="scl-scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
      {cappers.map((capper, index) => {
        const value =
          metric === "units"
            ? formatUnits(capper.units)
            : formatRoi(capper.roi);
        const tone = signTone(metric === "units" ? capper.units : capper.roi);

        return (
          <li
            key={capper.id}
            className="w-[18.5rem] shrink-0 snap-start sm:w-[20rem]"
          >
            <Link
              href={`/cappers/${capper.handle}`}
              className="border-border bg-card focus-visible:ring-ring scl-interactive scl-elevated grid min-h-24 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border px-3 py-2.5 outline-none focus-visible:ring-2"
            >
              <RankBadge rank={index + 1} className="size-9" />
              <CapperAvatar
                name={capper.name}
                src={capper.avatarUrl}
                size="sm"
              />
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1">
                  <span className="truncate text-sm font-semibold">
                    {capper.name}
                  </span>
                  {capper.verified ? <VerificationBadge size="xs" /> : null}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <SportTag sport={capper.topSport} />
                  <span className="nums text-muted-foreground truncate text-xs tabular-nums">
                    {formatRecord(
                      capper.record.w,
                      capper.record.l,
                      capper.record.p,
                    )}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span
                  className={cn(
                    "nums block text-lg font-bold tabular-nums",
                    toneText[tone],
                  )}
                >
                  {value}
                </span>
                <span className="text-muted-foreground text-[0.65rem] font-semibold tracking-wide uppercase">
                  {metric === "units" ? "Units" : "ROI"}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
