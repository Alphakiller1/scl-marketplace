import Link from "next/link";

import { Card } from "@/components/ui/card";
import type { CapperSummary } from "@/lib/mock";
import { CapperAvatar } from "@/components/scl/capper-avatar";
import { CapperIdentityLabel } from "@/components/scl/capper-identity-label";
import { SportTag, TrophyBadge, LegacyBadge } from "@/components/scl/badges";
import { RecentFormStrip, StreakChip } from "@/components/scl/indicators";
import { RoiStat, UnitStat, WinRateStat } from "@/components/scl/stat";
import { PerformanceSparkline } from "@/components/scl/performance-sparkline";
import { RankBadge } from "@/components/scl/rank-badge";
import { CompactCapperRow } from "@/components/scl/compact-capper-row";
import { isProvisional } from "@/lib/sample";

/** Discovery card — a capper's public résumé at a glance. */
export function CapperCard({
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
        primaryMetric="roi"
      />
    );
  }

  return (
    <Card className="group scl-interactive hover:border-border-strong relative gap-0 overflow-hidden p-3.5 sm:p-4">
      <div className="flex items-start gap-3">
        <RankBadge
          rank={rank ?? capper.rank}
          settledPicks={capper.settledPicks}
        />
        <CapperAvatar name={capper.name} src={capper.avatarUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <Link
            href={`/cappers/${capper.handle}`}
            className="focus-visible:ring-ring relative z-10 flex min-h-11 items-center rounded-lg outline-none before:absolute before:inset-0 hover:underline focus-visible:ring-2 sm:min-h-8"
          >
            <CapperIdentityLabel capper={capper} compact className="relative" />
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <SportTag sport={capper.topSport} />
            <StreakChip
              streak={capper.streak}
              gradedCount={capper.settledPicks ?? 0}
            />
            {capper.isLegacy ? <LegacyBadge /> : null}
          </div>
        </div>
      </div>

      <div className="bg-surface-2 mt-4 grid grid-cols-3 gap-2 rounded-lg p-3">
        <WinRateStat
          winPct={capper.winPct}
          className="items-center text-center"
        />
        <UnitStat units={capper.units} className="items-center text-center" />
        <div className="space-y-1">
          <RoiStat roi={capper.roi} className="items-center text-center" />
          {isProvisional(capper.settledPicks) ? (
            <span className="text-muted-foreground block text-center text-[0.65rem] font-semibold tracking-wide uppercase">
              Provisional
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex min-h-10 items-center justify-between gap-3">
        <div>
          <span className="text-muted-foreground block text-[0.7rem] font-semibold uppercase">
            {(capper.settledPicks ?? 0).toLocaleString()} Graded Picks
          </span>
          <RecentFormStrip form={capper.recentForm} className="mt-1" />
        </div>
        <PerformanceSparkline
          points={capper.performanceTrend}
          gradedCount={capper.settledPicks ?? 0}
          className="w-24"
        />
      </div>

      {capper.trophies[0] ? (
        <div className="mt-3">
          <TrophyBadge label={capper.trophies[0]} />
        </div>
      ) : null}
    </Card>
  );
}
