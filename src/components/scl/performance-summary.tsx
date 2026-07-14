import { cn } from "@/lib/utils";
import type { CapperSummary } from "@/lib/mock";
import { Card } from "@/components/ui/card";
import {
  RecordStat,
  RoiStat,
  StatBlock,
  UnitStat,
  WinRateStat,
} from "@/components/scl/stat";
import { RecentFormStrip, StreakChip } from "@/components/scl/indicators";
import { PerformanceSparkline } from "@/components/scl/performance-sparkline";

/**
 * The capper's headline performance — trust metrics first, then record depth
 * and recent form. ROI + verified share lead; supporting stats stay scannable.
 */
export function PerformanceSummary({
  capper,
  className,
}: {
  capper: CapperSummary;
  className?: string;
}) {
  const graded = capper.settledPicks ?? 0;
  const verifiedPct =
    capper.verifiedShare != null && capper.verifiedShare > 0
      ? Math.round(capper.verifiedShare)
      : null;

  return (
    <Card className={cn("gap-0 p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-muted-foreground text-[0.7rem] font-semibold tracking-wide uppercase">
          Performance
        </h2>
        <StreakChip streak={capper.streak} />
      </div>

      {/* Trust hierarchy: ROI + units carry sign color; verified share is the integrity signal */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <RoiStat roi={capper.roi} />
        <UnitStat units={capper.units} />
        <RecordStat record={capper.record} />
        <WinRateStat winPct={capper.winPct} />
      </div>

      <div className="border-border mt-4 grid gap-3 border-t pt-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {verifiedPct != null ? (
            <StatBlock
              label="Verified"
              value={`${verifiedPct}%`}
              tone="live"
              className="min-w-[4.5rem]"
            />
          ) : null}
          <StatBlock
            label="Graded"
            value={graded.toLocaleString()}
            className="min-w-[4.5rem]"
          />
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-[0.7rem] font-medium tracking-wide uppercase">
              Form
            </span>
            <RecentFormStrip form={capper.recentForm} />
          </div>
        </div>
        <PerformanceSparkline points={capper.performanceTrend} />
      </div>
    </Card>
  );
}
