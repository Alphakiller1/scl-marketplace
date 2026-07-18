import { ClvExplainer } from "@/components/scl/clv-explainer";
import { StatBlock } from "@/components/scl/stat";
import { CLV_TOOLTIP_SHORT } from "@/lib/clv";
import {
  PLATFORM_CLV_EMPTY_BODY,
  type ClvTrackerSummary,
} from "@/lib/clv-tracker";
import { countLabel } from "@/lib/league-action";
import { formatClvPts, missingCloseOrClvTooltip } from "@/lib/proof-receipt";
import { perfScale, perfToneClass } from "@/lib/perf-scale";
import { cn } from "@/lib/utils";

/**
 * Platform CLV summary — avg + % beat close across publicly listed /
 * board-verified picks with a stored close. Honest empty at cold start.
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
          "border-border bg-card rounded-xl border p-4 sm:p-5",
          className,
        )}
        role="status"
      >
        <p className="scl-eyebrow text-muted-foreground">Platform CLV</p>
        <p className="text-muted-foreground mt-2 text-sm">
          Closing-line metrics are temporarily unavailable.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-border bg-card space-y-4 rounded-xl border p-4 sm:p-5",
        className,
      )}
      data-visual-mode="proof"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="scl-display text-base font-bold tracking-[0.04em]">
            Platform CLV
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Board-verified closing snapshots across publicly listed cappers.
          </p>
        </div>
        <p className="scl-data text-muted-foreground text-xs tabular-nums">
          {countLabel(summary.snapshotCount, "snapshot", "snapshots")}
        </p>
      </div>

      {summary.snapshotCount === 0 ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          <span className="text-foreground font-semibold">{emptyTitle}</span>
          {" — "}
          {PLATFORM_CLV_EMPTY_BODY}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:max-w-lg sm:grid-cols-3">
          <div title={summary.avgClv == null ? emptyTitle : CLV_TOOLTIP_SHORT}>
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
            />
          </div>
          <div title={summary.beatClosePct == null ? emptyTitle : undefined}>
            <StatBlock
              label="% beat close"
              value={
                summary.beatClosePct != null
                  ? `${summary.beatClosePct.toFixed(1)}%`
                  : "—"
              }
            />
          </div>
          <StatBlock
            label="Snapshots"
            value={summary.snapshotCount.toLocaleString()}
          />
        </div>
      )}

      <ClvExplainer className="text-muted-foreground text-xs leading-relaxed" />
    </div>
  );
}
