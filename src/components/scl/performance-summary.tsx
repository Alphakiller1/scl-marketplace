import { cn } from "@/lib/utils";
import type { CapperSummary } from "@/lib/mock";
import { Card } from "@/components/ui/card";
import {
  RecordStat,
  RoiStat,
  UnitStat,
  WinRateStat,
} from "@/components/scl/stat";
import { RecentFormStrip, StreakChip } from "@/components/scl/indicators";

/**
 * The capper's headline performance — the numbers that earn trust. Record,
 * win rate, net units, and ROI on equal footing, with recent form below.
 */
export function PerformanceSummary({
  capper,
  className,
}: {
  capper: CapperSummary;
  className?: string;
}) {
  return (
    <Card className={cn("scl-card-gradient gap-0 p-5", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-muted-foreground text-[0.7rem] font-semibold tracking-wide uppercase">
          Performance
        </h2>
        <StreakChip streak={capper.streak} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <RecordStat record={capper.record} />
        <WinRateStat winPct={capper.winPct} />
        <UnitStat units={capper.units} />
        <RoiStat roi={capper.roi} />
      </div>

      <div className="border-border mt-4 flex items-center gap-3 border-t pt-4">
        <span className="text-muted-foreground text-[0.7rem] font-medium tracking-wide uppercase">
          Recent form
        </span>
        <RecentFormStrip form={capper.recentForm} />
      </div>
    </Card>
  );
}
