import { ClvDistributionChart } from "@/components/scl/clv-distribution-chart";
import { ClvExplainer } from "@/components/scl/clv-explainer";
import { StatBlock } from "@/components/scl/stat";
import { CLV_TOOLTIP_SHORT } from "@/lib/clv";
import {
  PLATFORM_CLV_EMPTY_BODY,
  type ClvTrackerSummary,
} from "@/lib/clv-tracker";
import { countLabel } from "@/lib/league-action";
import { formatClvPts, missingCloseOrClvTooltip } from "@/lib/proof-receipt";
import { MIN_GRADED_FOR_SIGNAL } from "@/lib/sample";
import { perfScale, perfToneClass } from "@/lib/perf-scale";
import { cn } from "@/lib/utils";

/**
 * Platform CLV evidence module — stored snapshot metrics + distribution.
 * CLV stays framed as pricing, never as a prediction or result.
 */
export function PlatformClvSummary({
  summary,
  failed = false,
  className,
}: {
  summary: ClvTrackerSummary;
  failed?: boolean;
  className?: string;
}) {
  const emptyTitle = missingCloseOrClvTooltip(null);
  const clvScale = perfScale("clv", summary.avgClv, {
    gradedCount: summary.snapshotCount,
  });

  if (failed) {
    return (
      <div
        className={cn(
          "border-border bg-card scl-elevated rounded-[var(--scl-radius-card)] border p-4 sm:p-5",
          className,
        )}
        role="status"
      >
        <p className="scl-eyebrow text-[color:var(--scl-muted-label)]">
          Closing-Price Evidence
        </p>
        <p className="text-muted-foreground mt-2 text-sm">
          Closing-Line Metrics Are Temporarily Unavailable.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-border bg-card scl-elevated relative overflow-hidden rounded-[var(--scl-radius-card)] border",
        className,
      )}
      data-visual-mode="proof"
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[color:var(--scl-blue)]"
        aria-hidden
      />

      <div className="border-border flex flex-wrap items-end justify-between gap-3 border-b px-4 py-4 pl-5 sm:px-5 sm:pl-6">
        <div>
          <h3 className="scl-display text-base font-bold tracking-[0.04em] normal-case">
            Closing-Price Evidence
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Submitted Prices Compared With The Same Book&apos;s Closing Prices.
          </p>
        </div>
        <p className="scl-data text-muted-foreground text-xs tabular-nums">
          {countLabel(summary.snapshotCount, "snapshot", "snapshots")}
        </p>
      </div>

      {summary.snapshotCount === 0 ? (
        <div className="px-4 py-6 pl-5 sm:px-5 sm:pl-6">
          <p className="text-foreground text-sm font-semibold">{emptyTitle}</p>
          <p className="text-muted-foreground mt-1 max-w-4xl text-sm leading-relaxed">
            {PLATFORM_CLV_EMPTY_BODY}
          </p>
        </div>
      ) : (
        <div className="grid gap-5 px-4 py-5 pl-5 sm:px-5 sm:pl-6 lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)] lg:gap-6">
          <section className="min-w-0" aria-labelledby="platform-clv-summary">
            <div className="flex items-end justify-between gap-3">
              <h4
                id="platform-clv-summary"
                className="scl-eyebrow text-[color:var(--scl-muted-label)]"
              >
                Pricing Summary
              </h4>
              <p className="scl-data text-muted-foreground text-xs tabular-nums">
                {summary.hasSignal
                  ? "Signal Threshold Met"
                  : `${summary.snapshotCount} Of ${MIN_GRADED_FOR_SIGNAL} Required`}
              </p>
            </div>

            <div className="border-border divide-border mt-2 grid grid-cols-3 divide-x overflow-hidden rounded-[10px] border">
              <div
                className="px-3 py-3"
                title={summary.avgClv == null ? emptyTitle : CLV_TOOLTIP_SHORT}
              >
                <StatBlock
                  label="Avg CLV"
                  value={
                    summary.avgClv != null ? formatClvPts(summary.avgClv) : "—"
                  }
                  valueClassName={
                    summary.avgClv != null
                      ? perfToneClass(clvScale.tone)
                      : undefined
                  }
                  aria-label={
                    summary.avgClv != null ? clvScale.ariaLabel : emptyTitle
                  }
                  truncateValue={false}
                />
              </div>
              <div
                className="px-3 py-3"
                title={
                  summary.beatClosePct == null
                    ? emptyTitle
                    : "Share of stored snapshots with positive CLV"
                }
              >
                <StatBlock
                  label="Beat close"
                  value={
                    summary.beatClosePct != null
                      ? `${summary.beatClosePct.toFixed(1)}%`
                      : "—"
                  }
                  truncateValue={false}
                />
              </div>
              <div className="px-3 py-3">
                <StatBlock
                  label="Snapshots"
                  value={summary.snapshotCount.toLocaleString()}
                  truncateValue={false}
                />
              </div>
            </div>

            <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
              Positive CLV means the submitted price beat the same book&apos;s
              close. It does not predict future results.
            </p>
          </section>

          <section className="border-border min-w-0 border-t pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
            <ClvDistributionChart summary={summary} embedded />
          </section>
        </div>
      )}

      <div className="border-border border-t px-4 py-2.5 pl-5 sm:px-5 sm:pl-6">
        <ClvExplainer compact />
      </div>
    </div>
  );
}
