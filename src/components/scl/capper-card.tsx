import Link from "next/link";

import { Card } from "@/components/ui/card";
import type { CapperSummary } from "@/lib/mock";
import { CapperAvatar } from "@/components/scl/capper-avatar";
import { CapperIdentityLabel } from "@/components/scl/capper-identity-label";
import { SportTag, TrophyBadge, LegacyBadge } from "@/components/scl/badges";
import { RecentFormStrip, StreakChip } from "@/components/scl/indicators";
import {
  RoiStat,
  UnitStat,
  WinRateStat,
  StatBlock,
} from "@/components/scl/stat";
import { PerformanceSparkline } from "@/components/scl/performance-sparkline";
import { RankBadge } from "@/components/scl/rank-badge";
import { CompactCapperRow } from "@/components/scl/compact-capper-row";
import { ProvisionalRecordHelp } from "@/components/scl/provisional-record-help";
import { formatLastPickDate } from "@/lib/capper-activity";
import { countLabel } from "@/lib/league-action";
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

  const sports = (capper.sports?.length ? capper.sports : [capper.topSport])
    .filter(Boolean)
    .slice(0, 3);
  const specialties = (capper.specialties ?? []).filter(Boolean).slice(0, 2);
  const lastPick = formatLastPickDate(capper.lastPlayAt);
  const graded = capper.settledPicks ?? 0;
  const provisional = isProvisional(graded);

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
            {sports.map((sport) => (
              <SportTag key={sport} sport={sport} />
            ))}
            <StreakChip streak={capper.streak} gradedCount={graded} />
            {capper.isLegacy ? <LegacyBadge /> : null}
          </div>
          {specialties.length || lastPick ? (
            <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              {specialties.map((specialty) => (
                <span
                  key={specialty}
                  className="border-border bg-surface-2 inline-flex min-h-7 items-center rounded-md border px-2 font-medium"
                >
                  {specialty}
                </span>
              ))}
              {lastPick ? (
                <span className="scl-data tabular-nums">
                  Last pick {lastPick}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="bg-surface-2 mt-4 grid min-w-0 grid-cols-3 gap-1.5 rounded-lg p-2 sm:gap-2 sm:p-3">
        {provisional ? (
          <>
            <StatBlock
              label="Win %"
              value="—"
              className="min-w-0 items-center text-center [&_.scl-data]:text-base sm:[&_.scl-data]:text-lg"
            />
            <StatBlock
              label="Units"
              value="—"
              className="min-w-0 items-center text-center [&_.scl-data]:text-base sm:[&_.scl-data]:text-lg"
            />
            <div className="min-w-0 space-y-1">
              <StatBlock
                label="ROI"
                value="—"
                className="min-w-0 items-center text-center [&_.scl-data]:text-base sm:[&_.scl-data]:text-lg"
              />
              <div className="flex justify-center">
                <ProvisionalRecordHelp label="Provisional" />
              </div>
            </div>
          </>
        ) : (
          <>
            <WinRateStat
              winPct={capper.winPct}
              gradedCount={graded}
              className="min-w-0 items-center text-center [&_.scl-data]:text-base sm:[&_.scl-data]:text-lg"
            />
            <UnitStat
              units={capper.units}
              gradedCount={graded}
              className="min-w-0 items-center text-center [&_.scl-data]:text-base sm:[&_.scl-data]:text-lg"
            />
            <RoiStat
              roi={capper.roi}
              gradedCount={graded}
              className="min-w-0 items-center text-center [&_.scl-data]:text-base sm:[&_.scl-data]:text-lg"
            />
          </>
        )}
      </div>

      <div className="mt-3 flex min-h-10 items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="text-muted-foreground block text-[0.7rem] font-semibold uppercase">
            {countLabel(graded, "graded pick", "graded picks")}
          </span>
          <RecentFormStrip form={capper.recentForm} className="mt-1" />
        </div>
        <PerformanceSparkline
          points={capper.performanceTrend}
          gradedCount={graded}
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
