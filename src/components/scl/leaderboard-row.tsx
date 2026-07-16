import Link from "next/link";

import type { CapperSummary } from "@/lib/mock";
import { formatRecord, formatRoi, formatUnits, signTone } from "@/lib/format";
import { isProvisional } from "@/lib/sample";
import { CapperAvatar } from "@/components/scl/capper-avatar";
import { CapperIdentityLabel } from "@/components/scl/capper-identity-label";
import { SportTag } from "@/components/scl/badges";
import { StatValue } from "@/components/scl/stat-value";
import { VerifiedBadge } from "@/components/scl/verified-badge";
import { RecentFormStrip } from "@/components/scl/indicators";
import { PerformanceSparkline } from "@/components/scl/performance-sparkline";
import { RankBadge } from "@/components/scl/rank-badge";
import { CompactCapperRow } from "@/components/scl/compact-capper-row";
import {
  LEADERBOARD_TABLE_COLS,
  LEADERBOARD_TABLE_GAP,
} from "@/components/scl/leaderboard-table";

/** Desktop leaderboard row — competitive, not administrative. */
export function LeaderboardRow({
  capper,
  rank,
}: {
  capper: CapperSummary;
  /** Position within the current list; falls back to the global units rank. */
  rank?: number;
}) {
  const graded = capper.settledPicks ?? 0;
  const provisional = isProvisional(graded);
  const place = rank ?? capper.rank;
  const roiNote =
    capper.avgClv != null
      ? `CLV ${capper.avgClv >= 0 ? "+" : ""}${capper.avgClv.toFixed(2)}`
      : provisional
        ? "Provisional"
        : null;

  return (
    <Link
      href={`/cappers/${capper.handle}`}
      className={`group hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:ring-ring grid min-h-[4.25rem] ${LEADERBOARD_TABLE_COLS} ${LEADERBOARD_TABLE_GAP} items-start py-2.5 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset`}
    >
      <div className="flex h-10 items-center">
        <RankBadge rank={place} settledPicks={graded} />
      </div>

      <div className="flex min-w-0 items-start gap-3 pt-0.5">
        <CapperAvatar name={capper.name} src={capper.avatarUrl} size="sm" />
        <div className="min-w-0 space-y-1">
          <div className="flex min-h-5 min-w-0 items-center gap-1.5">
            <CapperIdentityLabel
              capper={capper}
              compact
              verified={false}
              primaryClassName="text-sm"
            />
            {capper.verifiedShare != null && capper.verifiedShare > 0 ? (
              <VerifiedBadge
                verifiedShare={capper.verifiedShare}
                className="shrink-0"
              />
            ) : null}
          </div>
          <div className="text-muted-foreground flex min-h-5 items-center gap-1.5 text-xs">
            <SportTag sport={capper.topSport} markOnly className="shrink-0" />
            <span aria-hidden className="text-border">
              ·
            </span>
            <span className="scl-data tabular-nums">
              {formatRecord(capper.record.w, capper.record.l, capper.record.p)}
            </span>
          </div>
        </div>
      </div>

      <StatValue
        tone="text"
        className="pt-2 text-right text-sm font-semibold tabular-nums"
      >
        {capper.winPct.toFixed(1)}%
      </StatValue>
      <div className="pt-2 text-right">
        <StatValue
          tone={
            signTone(capper.roi) === "pos"
              ? "win"
              : signTone(capper.roi) === "neg"
                ? "loss"
                : "text"
          }
          className="text-sm font-semibold tabular-nums"
        >
          {formatRoi(capper.roi)}
        </StatValue>
        <span
          className="text-muted-foreground mt-0.5 block min-h-[1rem] truncate text-[0.65rem] font-semibold tracking-wide uppercase"
          title={
            capper.avgClv != null
              ? "Average closing-line value (pts) on board-verified plays with a recorded close"
              : provisional
                ? "Small graded sample — rank and ROI can swing until more results settle"
                : undefined
          }
        >
          {roiNote ?? "\u00A0"}
        </span>
      </div>
      <StatValue
        tone={
          signTone(capper.units) === "pos"
            ? "win"
            : signTone(capper.units) === "neg"
              ? "loss"
              : "text"
        }
        className="pt-2 text-right text-sm font-semibold tabular-nums"
      >
        {formatUnits(capper.units)}
      </StatValue>
      <StatValue
        tone="data"
        className="pt-2 text-right text-sm font-semibold tabular-nums"
      >
        {graded.toLocaleString()}
      </StatValue>
      <div className="flex justify-end pt-1">
        <PerformanceSparkline
          points={capper.performanceTrend}
          gradedCount={graded}
        />
      </div>
    </Link>
  );
}

/** Mobile leaderboard card — never a compressed table. */
export function LeaderboardMobileCard({
  capper,
  rank,
  compact = false,
  primaryMetric = "units",
}: {
  capper: CapperSummary;
  rank?: number;
  compact?: boolean;
  primaryMetric?: "units" | "roi";
}) {
  if (compact) {
    return (
      <CompactCapperRow
        capper={capper}
        rank={rank ?? capper.rank}
        primaryMetric={primaryMetric}
      />
    );
  }

  return (
    <Link
      href={`/cappers/${capper.handle}`}
      className="border-border bg-card active:bg-surface-2 focus-visible:ring-ring flex min-h-40 flex-col gap-3 rounded-xl border p-3.5 focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="flex items-center gap-3">
        <RankBadge
          rank={rank ?? capper.rank}
          settledPicks={capper.settledPicks}
        />
        <CapperAvatar name={capper.name} src={capper.avatarUrl} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <CapperIdentityLabel capper={capper} compact verified={false} />
            {capper.verifiedShare != null && capper.verifiedShare > 0 ? (
              <VerifiedBadge verifiedShare={capper.verifiedShare} />
            ) : null}
          </div>
          <div className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
            <SportTag sport={capper.topSport} markOnly className="shrink-0" />
            <span aria-hidden className="text-border">
              ·
            </span>
            <StatValue tone="label" className="text-xs">
              {formatRecord(capper.record.w, capper.record.l, capper.record.p)}
            </StatValue>
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
          <StatValue tone="text" className="font-semibold">
            {(capper.settledPicks ?? 0).toLocaleString()}
          </StatValue>{" "}
          Graded Picks
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
      <StatValue
        tone={tone === "pos" ? "win" : tone === "neg" ? "loss" : "text"}
        className="font-semibold"
      >
        {value}
      </StatValue>
      <span className="text-muted-foreground text-[0.7rem] font-medium tracking-wide uppercase">
        {label}
      </span>
    </div>
  );
}
