import { cn } from "@/lib/utils";
import type { CapperSummary } from "@/lib/mock";
import { Card } from "@/components/ui/card";
import { ClvExplainer } from "@/components/scl/clv-explainer";
import { CLV_TOOLTIP_SHORT } from "@/lib/clv";
import {
  RecordStat,
  RoiStat,
  StatBlock,
  UnitStat,
  WinRateStat,
} from "@/components/scl/stat";
import { RecentFormStrip, StreakChip } from "@/components/scl/indicators";
import { PerformanceSparkline } from "@/components/scl/performance-sparkline";
import { ProvisionalRecordHelp } from "@/components/scl/provisional-record-help";
import { VerificationHelpLink } from "@/components/scl/verification-help-link";
import { isProvisional, hasSignal } from "@/lib/sample";

/**
 * The capper's headline performance — trust metrics first, then record depth
 * and recent form. Small samples show honest empties (no fabricated trend/streak).
 */
export function PerformanceSummary({
  capper,
  avgClv,
  className,
}: {
  capper: CapperSummary;
  avgClv?: number | null;
  className?: string;
}) {
  const graded = capper.settledPicks ?? 0;
  const provisional = isProvisional(graded);
  const signal = hasSignal(graded);
  const verifiedPct =
    capper.verifiedShare != null && capper.verifiedShare > 0
      ? Math.round(capper.verifiedShare)
      : null;

  return (
    <Card className={cn("gap-0 p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-muted-foreground text-[0.7rem] font-semibold tracking-wide uppercase">
          Performance
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {provisional ? <ProvisionalRecordHelp /> : null}
          <StreakChip streak={capper.streak} gradedCount={graded} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="space-y-1.5">
          <RoiStat roi={capper.roi} />
          {provisional ? (
            <span
              className="border-border text-muted-foreground inline-flex min-h-8 items-center rounded-md border px-2 text-[0.7rem] font-semibold tracking-wide uppercase"
              title="Small graded sample — ROI is provisional"
            >
              Provisional
            </span>
          ) : null}
        </div>
        <UnitStat units={capper.units} />
        <RecordStat record={capper.record} />
        <WinRateStat winPct={capper.winPct} />
      </div>

      {provisional ? (
        <p
          className="text-muted-foreground mt-3 text-xs leading-relaxed"
          role="status"
        >
          {graded.toLocaleString()} graded — building a record. Rank and ROI can
          swing until the sample grows.
        </p>
      ) : null}

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
          {signal ? (
            <span title={CLV_TOOLTIP_SHORT}>
              <StatBlock
                label="Avg CLV"
                value={
                  avgClv != null
                    ? `${avgClv >= 0 ? "+" : ""}${avgClv.toFixed(2)} pts`
                    : "—"
                }
                className="min-w-[4.5rem]"
              />
            </span>
          ) : null}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-[0.7rem] font-medium tracking-wide uppercase">
              Form
            </span>
            <RecentFormStrip form={capper.recentForm} />
          </div>
        </div>
        <PerformanceSparkline
          points={capper.performanceTrend}
          gradedCount={graded}
        />
      </div>
      {signal ? (
        <ClvExplainer className="text-muted-foreground mt-3 text-xs leading-relaxed" />
      ) : null}

      <div className="border-border mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3">
        <VerificationHelpLink />
        <a
          href="/responsible-gaming"
          className="text-muted-foreground hover:text-foreground inline-flex min-h-10 items-center text-xs underline-offset-4 hover:underline"
        >
          Responsible gaming
        </a>
      </div>
    </Card>
  );
}
