import { MIN_GRADED_FOR_SIGNAL, hasSignal } from "@/lib/sample";
import { cn } from "@/lib/utils";

const CHART_WIDTH = 1000;
const CHART_HEIGHT = 160;
const CHART_TOP = 8;
const CHART_BOTTOM = 10;
const GRID_STEPS = [0, 0.25, 0.5, 0.75, 1] as const;

export type CumulativePoint = {
  /** 1-based graded pick index (oldest → newest). */
  n: number;
  units: number;
};

/**
 * Cumulative units chart — zero baseline, stable domain, accessible text summary.
 * Honest empty when graded &lt; MIN_GRADED_FOR_SIGNAL.
 */
export function CumulativeUnitsChart({
  points,
  gradedCount,
  startsFromLegacyBalance = false,
  className,
}: {
  points: CumulativePoint[];
  gradedCount: number;
  /** All-window series that starts at the carried-over legacy net. */
  startsFromLegacyBalance?: boolean;
  className?: string;
}) {
  if (!hasSignal(gradedCount) || points.length < 2) {
    return (
      <div
        className={cn(
          "border-border bg-surface-2 flex min-h-[11rem] flex-col justify-center rounded-xl border px-4 py-6",
          className,
        )}
        role="status"
      >
        <p className="scl-eyebrow text-muted-foreground">Cumulative units</p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Chart unlocks after {MIN_GRADED_FOR_SIGNAL} graded plays. Current
          sample: {gradedCount.toLocaleString()} — showing an honest empty, not
          a fabricated trend.
        </p>
      </div>
    );
  }

  const values = points.map((p) => p.units);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const pad = Math.max(0.5, (max - min) * 0.08);
  const domain: [number, number] = [min - pad, max + pad];
  const last = points[points.length - 1]!.units;
  const summary = startsFromLegacyBalance
    ? `Cumulative units from ${gradedCount} graded receipts, starting from the carried-over legacy balance. Ending balance ${last >= 0 ? "+" : ""}${last.toFixed(2)} units.`
    : `Cumulative units across ${gradedCount} graded plays. Ending balance ${last >= 0 ? "+" : ""}${last.toFixed(2)} units.`;
  const plotHeight = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM;
  const domainRange = domain[1] - domain[0];
  const xFor = (index: number) =>
    (index / Math.max(1, points.length - 1)) * CHART_WIDTH;
  const yFor = (units: number) =>
    CHART_TOP + ((domain[1] - units) / domainRange) * plotHeight;
  const zeroY = yFor(0);
  const linePath = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${xFor(index).toFixed(2)},${yFor(point.units).toFixed(2)}`,
    )
    .join(" ");
  const areaPath = `${linePath} L${CHART_WIDTH},${zeroY.toFixed(2)} L0,${zeroY.toFixed(2)} Z`;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="scl-eyebrow text-muted-foreground">Cumulative units</p>
        <p className="scl-data text-muted-foreground text-xs tabular-nums">
          End {last >= 0 ? "+" : ""}
          {last.toFixed(2)}U
        </p>
      </div>
      <div
        className="border-border bg-card h-44 w-full min-w-0 overflow-hidden rounded-xl border px-1 pt-3 pb-1"
        role="img"
        aria-label={summary}
      >
        <svg
          className="block size-full"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {GRID_STEPS.map((step) => {
            const y = CHART_TOP + step * plotHeight;
            return (
              <line
                key={step}
                x1="0"
                x2={CHART_WIDTH}
                y1={y}
                y2={y}
                stroke="var(--scl-line)"
                strokeDasharray="3 5"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
          <line
            x1="0"
            x2={CHART_WIDTH}
            y1={zeroY}
            y2={zeroY}
            stroke="var(--scl-muted-label)"
            vectorEffect="non-scaling-stroke"
          />
          <path d={areaPath} fill="var(--scl-pink)" fillOpacity="0.13" />
          <path
            d={linePath}
            fill="none"
            stroke="var(--scl-pink)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {points.map((point, index) => (
            <circle
              key={point.n}
              cx={xFor(index)}
              cy={yFor(point.units)}
              r="2.75"
              fill="var(--scl-pink)"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>
      <p className="sr-only">{summary}</p>
    </div>
  );
}

/** Build cumulative series from oldest→newest graded profit units. */
export function buildCumulativeUnits(
  profitUnitsChronological: number[],
): CumulativePoint[] {
  let run = 0;
  return profitUnitsChronological.map((p, i) => {
    run += p;
    return { n: i + 1, units: Math.round((run + Number.EPSILON) * 100) / 100 };
  });
}
