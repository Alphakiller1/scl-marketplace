import {
  MATURITY,
  MATURITY_LEGEND,
  maturityBucket,
  maturityLabel,
} from "@/lib/sample";
import { cn } from "@/lib/utils";

/**
 * Sample maturity meter — Rank + Proof surfaces.
 * Early caps at amber (never red); Established uses perf-strong.
 */
export function SampleMaturityMeter({
  graded,
  compact = false,
  showLegend = false,
  className,
}: {
  graded: number;
  /** Dense leaderboard cell — meter + count on one row. */
  compact?: boolean;
  showLegend?: boolean;
  className?: string;
}) {
  const bucket = maturityBucket(graded);
  const label = maturityLabel(graded);
  const pct = Math.min(100, Math.round((graded / MATURITY.ESTABLISHED) * 100));

  const meter = (
    <div
      className={cn(
        "bg-surface-2 border-border overflow-hidden rounded-full border",
        compact ? "h-1 min-w-0 flex-1" : "h-1.5",
      )}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={MATURITY.ESTABLISHED}
      aria-valuenow={Math.min(graded, MATURITY.ESTABLISHED)}
      aria-label={`Sample maturity: ${label}, ${graded} graded`}
    >
      <div
        className={cn(
          "h-full rounded-full",
          bucket === "established"
            ? "bg-[color:var(--scl-perf-strong)]"
            : "bg-[color:var(--scl-perf-mid)]",
          bucket === "early" && "opacity-80",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );

  if (compact) {
    return (
      <div
        className={cn(
          "flex w-full min-w-0 items-center justify-end gap-1.5",
          className,
        )}
      >
        {meter}
        <p className="scl-data text-muted-foreground shrink-0 text-[0.65rem] tabular-nums">
          {graded}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="scl-eyebrow text-[color:var(--scl-muted-label)]">
          Sample maturity
        </p>
        <p className="scl-data text-muted-foreground text-xs tabular-nums">
          {label} · {graded} graded
        </p>
      </div>
      {meter}
      {showLegend ? (
        <p className="text-muted-foreground text-xs leading-relaxed">
          {MATURITY_LEGEND}
        </p>
      ) : null}
    </div>
  );
}
