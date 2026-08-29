"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function AdminOddsUsageChart({
  history,
}: {
  history: { date: string; credits: number }[];
}) {
  if (!history.some((row) => row.credits > 0)) {
    return (
      <div className="border-border bg-surface-2 text-muted-foreground flex min-h-56 items-center justify-center rounded-xl border p-6 text-center text-sm">
        Usage history will appear here after API calls are recorded.
      </div>
    );
  }

  return (
    <div className="h-64 w-full" aria-label="Daily API credit usage chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={history}
          margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
        >
          <defs>
            <linearGradient id="odds-credit-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.42} />
              <stop
                offset="95%"
                stopColor="var(--chart-2)"
                stopOpacity={0.02}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => value.slice(5)}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              color: "var(--popover-foreground)",
            }}
            formatter={(value) => [
              `${Number(value).toLocaleString()} credits`,
              "Usage",
            ]}
            labelFormatter={(label) =>
              new Date(`${label}T12:00:00Z`).toLocaleDateString()
            }
          />
          <Area
            type="monotone"
            dataKey="credits"
            stroke="var(--chart-2)"
            strokeWidth={2}
            fill="url(#odds-credit-fill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
