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

export function CompactCapperRow({
  capper,
  rank,
  primaryMetric,
}: {
  capper: CapperSummary;
  rank: number;
  primaryMetric: "units" | "roi";
}) {
  const primaryValue =
    primaryMetric === "units"
      ? formatUnits(capper.units)
      : formatRoi(capper.roi);
  const primaryTone = signTone(
    primaryMetric === "units" ? capper.units : capper.roi,
  );
  const secondaryValue =
    primaryMetric === "units"
      ? `${formatRoi(capper.roi)} ROI`
      : `${formatUnits(capper.units)} Units`;

  return (
    <Link
      href={`/cappers/${capper.handle}`}
      className="border-border bg-card active:bg-surface-2 focus-visible:ring-ring block min-h-24 rounded-xl border p-3 transition-colors outline-none focus-visible:ring-2"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <RankBadge rank={rank} className="size-9" />
        <CapperAvatar name={capper.name} src={capper.avatarUrl} size="sm" />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate text-sm font-semibold">
              {capper.name}
            </span>
            {capper.verified ? <VerificationBadge size="xs" /> : null}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <SportTag
              sport={capper.topSport}
              className="max-w-24 truncate whitespace-nowrap"
            />
            <span className="nums text-muted-foreground truncate text-xs tabular-nums">
              {formatRecord(capper.record.w, capper.record.l, capper.record.p)}
            </span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <span
            className={cn(
              "nums block text-base font-bold tabular-nums",
              toneText[primaryTone],
            )}
          >
            {primaryValue}
          </span>
          <span className="text-muted-foreground text-[0.7rem] font-semibold uppercase">
            {primaryMetric === "units" ? "Units" : "ROI"}
          </span>
        </div>
      </div>

      <div className="border-border text-muted-foreground mt-2 flex min-w-0 items-center gap-2 border-t pt-2 text-xs">
        <span className="nums shrink-0 tabular-nums">
          <span className="text-foreground font-semibold">
            {capper.winPct.toFixed(1)}%
          </span>{" "}
          Win
        </span>
        <span aria-hidden>·</span>
        <span
          className={cn(
            "nums shrink-0 font-semibold tabular-nums",
            toneText[
              signTone(primaryMetric === "units" ? capper.roi : capper.units)
            ],
          )}
        >
          {secondaryValue}
        </span>
        <span className="nums ml-auto truncate text-right tabular-nums">
          {(capper.settledPicks ?? 0).toLocaleString()} Graded Picks
        </span>
      </div>
    </Link>
  );
}
