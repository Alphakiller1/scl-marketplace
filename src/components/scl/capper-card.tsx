import Link from "next/link";

import { Card } from "@/components/ui/card";
import type { CapperSummary } from "@/lib/mock";
import { CapperAvatar } from "@/components/scl/capper-avatar";
import {
  VerificationBadge,
  SportTag,
  TrophyBadge,
  LegacyBadge,
} from "@/components/scl/badges";
import { RecentFormStrip, StreakChip } from "@/components/scl/indicators";
import { RoiStat, UnitStat, WinRateStat } from "@/components/scl/stat";
import { PerformanceSparkline } from "@/components/scl/performance-sparkline";
import { RankBadge } from "@/components/scl/rank-badge";

/** Discovery card — a capper's public résumé at a glance. */
export function CapperCard({
  capper,
  rank,
}: {
  capper: CapperSummary;
  /** Position within the current list; falls back to the global units rank. */
  rank?: number;
}) {
  return (
    <Card className="group hover:border-border-strong relative gap-0 overflow-hidden p-4 transition-colors">
      <div className="flex items-start gap-3">
        <RankBadge rank={rank ?? capper.rank} />
        <CapperAvatar name={capper.name} src={capper.avatarUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <Link
            href={`/cappers/${capper.handle}`}
            className="flex items-center gap-1.5 font-semibold hover:underline"
          >
            <span className="truncate">{capper.name}</span>
            {capper.verified ? <VerificationBadge size="sm" /> : null}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <SportTag sport={capper.topSport} />
            <StreakChip streak={capper.streak} />
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
        <RoiStat roi={capper.roi} className="items-center text-center" />
      </div>

      <div className="mt-3 flex min-h-10 items-center justify-between gap-3">
        <div>
          <span className="text-muted-foreground block text-[0.7rem] font-semibold uppercase">
            {(capper.settledPicks ?? 0).toLocaleString()} graded picks
          </span>
          <RecentFormStrip form={capper.recentForm} className="mt-1" />
        </div>
        <PerformanceSparkline
          points={capper.performanceTrend}
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
