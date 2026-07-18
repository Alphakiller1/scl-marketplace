"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  CLV_TRACKER_EMPTY_BODY,
  CLV_TRACKER_EMPTY_TITLE,
  CLV_TRACKER_PROVISIONAL_BODY,
  type ClvTrackerSummary,
} from "@/lib/clv-tracker";
import { countLabel } from "@/lib/league-action";
import { MIN_GRADED_FOR_SIGNAL } from "@/lib/sample";
import { cn } from "@/lib/utils";

/**
 * CLV distribution histogram — zero baseline, stable domain, accessible summary.
 * Bars use blue (pricing / board), never settlement green/red.
 */
export function ClvDistributionChart({
  summary,
  className,
}: {
  summary: ClvTrackerSummary;
  className?: string;
}) {
  if (summary.snapshotCount === 0) {
    return (
      <div
        className={cn(
          "border-border bg-surface-2 flex min-h-[11rem] flex-col justify-center rounded-xl border px-4 py-6",
          className,
        )}
        role="status"
      >
        <p className="scl-eyebrow text-muted-foreground">CLV distribution</p>
        <p className="text-foreground mt-2 text-sm font-semibold">
          {CLV_TRACKER_EMPTY_TITLE}
        </p>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          {CLV_TRACKER_EMPTY_BODY}
        </p>
      </div>
    );
  }

  if (!summary.hasSignal) {
    return (
      <div
        className={cn(
          "border-border bg-surface-2 flex min-h-[11rem] flex-col justify-center rounded-xl border px-4 py-6",
          className,
        )}
        role="status"
      >
        <p className="scl-eyebrow text-muted-foreground">CLV distribution</p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          {CLV_TRACKER_PROVISIONAL_BODY} Current snapshots:{" "}
          {summary.snapshotCount.toLocaleString()} of {MIN_GRADED_FOR_SIGNAL}.
        </p>
      </div>
    );
  }

  const maxCount = Math.max(1, ...summary.bins.map((b) => b.count));

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="scl-eyebrow text-muted-foreground">CLV distribution</p>
        <p className="scl-data text-muted-foreground text-xs tabular-nums">
          {countLabel(summary.snapshotCount, "snapshot", "snapshots")}
        </p>
      </div>
      <div
        className="border-border bg-card h-44 w-full min-w-0 overflow-hidden rounded-xl border px-1 pt-3 pb-1"
        role="img"
        aria-label={summary.distributionSummary}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={summary.bins}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              stroke="var(--scl-line)"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--scl-muted-label)", fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              interval={0}
            />
            <YAxis
              domain={[0, maxCount]}
              allowDecimals={false}
              tick={{ fill: "var(--scl-muted-label)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={28}
            />
            <ReferenceLine y={0} stroke="var(--scl-muted-label)" />
            <Tooltip
              cursor={{
                fill: "color-mix(in oklab, var(--scl-blue) 12%, transparent)",
              }}
              contentStyle={{
                background: "var(--scl-ink-800)",
                border: "1px solid var(--scl-line)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value) => [
                countLabel(Number(value), "pick", "picks"),
                "Count",
              ]}
              labelFormatter={(label) => `CLV bin ${label}`}
            />
            <Bar
              dataKey="count"
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            >
              {summary.bins.map((bin) => (
                <Cell
                  key={bin.label}
                  fill={
                    bin.from < 0 && bin.to > 0
                      ? "var(--scl-blue)"
                      : "color-mix(in oklab, var(--scl-blue) 72%, var(--scl-ink-700))"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="sr-only">{summary.distributionSummary}</p>
    </div>
  );
}
