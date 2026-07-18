"use client";

import { ClvDistributionChart } from "@/components/scl/clv-distribution-chart";
import { ClvExplainer } from "@/components/scl/clv-explainer";
import { StatBlock } from "@/components/scl/stat";
import { CLV_TOOLTIP_SHORT } from "@/lib/clv";
import {
  CLV_TRACKER_EMPTY_TITLE,
  type ClvTrackerSummary,
} from "@/lib/clv-tracker";
import { countLabel } from "@/lib/league-action";
import { formatClvPts, missingCloseOrClvTooltip } from "@/lib/proof-receipt";
import { perfScale, perfToneClass } from "@/lib/perf-scale";
import { cn } from "@/lib/utils";

/**
 * Per-capper CLV panel — Analyst / Audit Trust Lens.
 * Reads stored clvPts summaries only; pricing framing, never predictive.
 */
export function ClvTrackerPanel({
  summary,
  className,
}: {
  summary: ClvTrackerSummary;
  className?: string;
}) {
  const clvScale = perfScale("clv", summary.avgClv, {
    gradedCount: summary.snapshotCount,
  });
  const emptyTitle = missingCloseOrClvTooltip(null);

  const avgDisplay =
    summary.avgClv != null ? formatClvPts(summary.avgClv) : "—";
  const beatDisplay =
    summary.beatClosePct != null ? `${summary.beatClosePct.toFixed(1)}%` : "—";

  return (
    <div
      className={cn(
        "border-border bg-card space-y-4 rounded-xl border p-4",
        className,
      )}
      data-visual-mode="proof"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="scl-eyebrow text-muted-foreground">CLV tracker</h3>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            Pricing metric — submitted price vs the same book&apos;s close.
          </p>
        </div>
        <p className="scl-data text-muted-foreground text-xs tabular-nums">
          {countLabel(summary.snapshotCount, "snapshot", "snapshots")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <div title={summary.avgClv == null ? emptyTitle : CLV_TOOLTIP_SHORT}>
          <StatBlock
            label="Avg CLV"
            value={avgDisplay}
            valueClassName={
              summary.avgClv != null ? perfToneClass(clvScale.tone) : undefined
            }
            aria-label={
              summary.avgClv != null
                ? clvScale.ariaLabel
                : `${CLV_TRACKER_EMPTY_TITLE}: ${emptyTitle}`
            }
          />
        </div>
        <div
          title={
            summary.beatClosePct == null
              ? emptyTitle
              : "Share of closing snapshots with positive CLV (beat the close)"
          }
        >
          <StatBlock
            label="% beat close"
            value={beatDisplay}
            aria-label={
              summary.beatClosePct != null
                ? `${summary.beatClosePct.toFixed(1)} percent of snapshots beat the close`
                : `${CLV_TRACKER_EMPTY_TITLE}: ${emptyTitle}`
            }
          />
        </div>
      </div>

      <ClvDistributionChart summary={summary} />
      <ClvExplainer className="text-muted-foreground text-xs leading-relaxed" />
    </div>
  );
}
