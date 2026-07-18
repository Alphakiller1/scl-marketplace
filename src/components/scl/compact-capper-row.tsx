import Link from "next/link";

import { CapperAvatar } from "@/components/scl/capper-avatar";
import { CapperIdentityLabel } from "@/components/scl/capper-identity-label";
import { SportTag } from "@/components/scl/badges";
import { RankBadge } from "@/components/scl/rank-badge";
import { StatValue } from "@/components/scl/stat-value";
import { cn } from "@/lib/utils";
import { formatRecord, formatRoi, formatUnits, signTone } from "@/lib/format";
import { isProvisional } from "@/lib/sample";
import type { CapperSummary } from "@/lib/mock";

export function CompactCapperRow({
  capper,
  rank,
  primaryMetric,
  variant = "card",
}: {
  capper: CapperSummary;
  rank: number | null | undefined;
  primaryMetric: "units" | "roi";
  /** Flush hairline row for live evidence panes (no nested card). */
  variant?: "card" | "flush";
}) {
  const graded = capper.settledPicks ?? 0;
  const provisional = isProvisional(graded);
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
  const secondaryTone = signTone(
    primaryMetric === "units" ? capper.roi : capper.units,
  );
  const flush = variant === "flush";

  return (
    <Link
      href={`/cappers/${capper.handle}`}
      className={cn(
        "focus-visible:ring-ring block outline-none focus-visible:ring-2",
        flush
          ? "hover:bg-surface-2/60 min-h-16 py-2.5 focus-visible:ring-inset"
          : "border-border bg-card active:bg-surface-2 scl-interactive scl-elevated min-h-24 rounded-xl border p-3",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <RankBadge rank={rank} settledPicks={graded} className="size-9" />
        <CapperAvatar name={capper.name} src={capper.avatarUrl} size="sm" />

        <div className="min-w-0 flex-1">
          <CapperIdentityLabel
            capper={capper}
            compact
            primaryClassName="text-sm"
          />
          <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
            <SportTag sport={capper.topSport} markOnly />
            <span aria-hidden className="text-border">
              ·
            </span>
            <StatValue tone="label" className="scl-data truncate text-xs">
              {formatRecord(capper.record.w, capper.record.l, capper.record.p)}
            </StatValue>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <StatValue
            tone={
              primaryTone === "pos"
                ? "win"
                : primaryTone === "neg"
                  ? "loss"
                  : "text"
            }
            className="block text-base font-bold"
          >
            {primaryValue}
          </StatValue>
          <span className="text-muted-foreground text-[0.7rem] font-semibold uppercase">
            {primaryMetric === "units" ? "Units" : "ROI"}
            {provisional ? " · Prov." : ""}
          </span>
        </div>
      </div>

      {!flush ? (
        <div className="border-border text-muted-foreground mt-2 flex min-w-0 items-center gap-2 border-t pt-2 text-xs">
          <span className="shrink-0">
            <StatValue tone="text" className="font-semibold">
              {capper.winPct.toFixed(1)}%
            </StatValue>{" "}
            Win
          </span>
          <span aria-hidden>·</span>
          <StatValue
            tone={
              secondaryTone === "pos"
                ? "win"
                : secondaryTone === "neg"
                  ? "loss"
                  : "data"
            }
            className={cn("shrink-0 font-semibold")}
          >
            {secondaryValue}
          </StatValue>
          <StatValue tone="label" className="ml-auto truncate text-right">
            {provisional
              ? `${graded.toLocaleString()} graded — provisional`
              : `${graded.toLocaleString()} Graded Picks`}
          </StatValue>
        </div>
      ) : null}
    </Link>
  );
}
