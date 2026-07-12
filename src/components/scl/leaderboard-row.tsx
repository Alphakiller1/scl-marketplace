import Link from "next/link";

import { cn } from "@/lib/utils";
import type { CapperSummary } from "@/lib/mock";
import { formatRecord, formatRoi, formatUnits, signTone } from "@/lib/format";
import { CapperAvatar } from "@/components/scl/capper-avatar";
import { VerificationBadge, SportTag } from "@/components/scl/badges";
import { RecentFormStrip } from "@/components/scl/indicators";
import { PerformanceSparkline } from "@/components/scl/performance-sparkline";
import { RankBadge } from "@/components/scl/rank-badge";
import { CompactCapperRow } from "@/components/scl/compact-capper-row";

const toneText = { pos: "text-pos", neg: "text-neg", muted: "text-foreground" };

/** Desktop leaderboard row — competitive, not administrative. */
export function LeaderboardRow({
  capper,
  rank,
}: {
  capper: CapperSummary;
  /** Position within the current list; falls back to the global units rank. */
  rank?: number;
}) {
  return (
    <Link
      href={`/cappers/${capper.handle}`}
      className="group hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:ring-ring grid min-h-16 grid-cols-[3.25rem_minmax(13rem,1fr)_5.5rem_5.5rem_5.5rem_4.5rem_8rem] items-center gap-3 px-3 py-2.5 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
    >
      <RankBadge rank={rank ?? capper.rank} />

      <div className="flex min-w-0 items-center gap-3">
        <CapperAvatar name={capper.name} src={capper.avatarUrl} size="sm" />
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span className="truncate font-semibold">{capper.name}</span>
            {capper.verified ? <VerificationBadge size="xs" /> : null}
          </div>
          <div className="flex items-center gap-1.5">
            <SportTag sport={capper.topSport} />
            <span className="nums text-muted-foreground text-xs tabular-nums">
              {formatRecord(capper.record.w, capper.record.l, capper.record.p)}
            </span>
          </div>
        </div>
      </div>

      <span className="nums text-right font-semibold tabular-nums">
        {capper.winPct.toFixed(1)}%
      </span>
      <span
        className={cn(
          "nums text-right font-semibold tabular-nums",
          toneText[signTone(capper.roi)],
        )}
      >
        {formatRoi(capper.roi)}
      </span>
      <span
        className={cn(
          "nums text-right font-semibold tabular-nums",
          toneText[signTone(capper.units)],
        )}
      >
        {formatUnits(capper.units)}
      </span>
      <div className="text-right">
        <div className="nums text-muted-foreground text-sm font-semibold tabular-nums">
          {(capper.settledPicks ?? 0).toLocaleString()}
        </div>
        {capper.verifiedShare != null && capper.verifiedShare > 0 ? (
          <div
            className="nums text-live text-[0.7rem] font-medium tabular-nums"
            title="Share of tracked picks market-verified"
          >
            {Math.round(capper.verifiedShare)}% ver.
          </div>
        ) : null}
      </div>
      <div className="flex justify-end">
        <PerformanceSparkline points={capper.performanceTrend} />
      </div>
    </Link>
  );
}

/** Mobile leaderboard card — never a compressed table. */
export function LeaderboardMobileCard({
  capper,
  rank,
  compact = false,
}: {
  capper: CapperSummary;
  /** Position within the current list; falls back to the global units rank. */
  rank?: number;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <CompactCapperRow
        capper={capper}
        rank={rank ?? capper.rank}
        primaryMetric="units"
      />
    );
  }

  return (
    <Link
      href={`/cappers/${capper.handle}`}
      className="border-border bg-card active:bg-surface-2 focus-visible:ring-ring flex min-h-40 flex-col gap-3 rounded-xl border p-3.5 focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="flex items-center gap-3">
        <RankBadge rank={rank ?? capper.rank} />
        <CapperAvatar name={capper.name} src={capper.avatarUrl} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate font-semibold">{capper.name}</span>
            {capper.verified ? <VerificationBadge size="xs" /> : null}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <SportTag sport={capper.topSport} />
            <span className="nums text-muted-foreground text-xs tabular-nums">
              {formatRecord(capper.record.w, capper.record.l, capper.record.p)}
            </span>
          </div>
        </div>
      </div>
      <div className="border-border grid grid-cols-3 gap-2 border-t pt-3">
        <MobileStat label="Win" value={`${capper.winPct.toFixed(1)}%`} />
        <MobileStat
          label="Units"
          value={formatUnits(capper.units)}
          tone={signTone(capper.units)}
        />
        <MobileStat
          label="ROI"
          value={formatRoi(capper.roi)}
          tone={signTone(capper.roi)}
        />
      </div>
      <div className="bg-surface-2 flex min-h-11 items-center justify-between gap-3 rounded-lg px-3">
        <span className="text-muted-foreground text-xs">
          <span className="nums text-foreground font-semibold tabular-nums">
            {(capper.settledPicks ?? 0).toLocaleString()}
          </span>{" "}
          Graded Picks
          {capper.verifiedShare != null && capper.verifiedShare > 0 ? (
            <span className="text-live ml-2 font-medium">
              {Math.round(capper.verifiedShare)}% Verified
            </span>
          ) : null}
        </span>
        <RecentFormStrip form={capper.recentForm.slice(-5)} />
      </div>
    </Link>
  );
}

function MobileStat({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg" | "muted";
}) {
  return (
    <div className="flex flex-col items-center">
      <span className={cn("nums font-semibold tabular-nums", toneText[tone])}>
        {value}
      </span>
      <span className="text-muted-foreground text-[0.7rem] font-medium tracking-wide uppercase">
        {label}
      </span>
    </div>
  );
}
