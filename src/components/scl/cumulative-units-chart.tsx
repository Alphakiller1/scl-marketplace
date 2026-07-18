"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { MIN_GRADED_FOR_SIGNAL, hasSignal } from "@/lib/sample";
import { cn } from "@/lib/utils";

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
  className,
}: {
  points: CumulativePoint[];
  gradedCount: number;
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
  const summary = `Cumulative units across ${points.length} graded plays. Ending balance ${last >= 0 ? "+" : ""}${last.toFixed(2)} units.`;

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
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={points}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              stroke="var(--scl-line)"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="n"
              tick={{ fill: "var(--scl-muted-label)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              domain={domain}
              tick={{ fill: "var(--scl-muted-label)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={36}
              tickFormatter={(v: number) => v.toFixed(0)}
            />
            <ReferenceLine
              y={0}
              stroke="var(--scl-muted-label)"
              strokeWidth={1}
            />
            <Tooltip
              contentStyle={{
                background: "var(--scl-ink-800)",
                border: "1px solid var(--scl-line)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(n) => `Graded #${n}`}
              formatter={(value) => [
                `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(2)}U`,
                "Cumulative",
              ]}
            />
            <Area
              type="monotone"
              dataKey="units"
              stroke="var(--scl-pink)"
              fill="color-mix(in oklab, var(--scl-pink) 18%, transparent)"
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
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
