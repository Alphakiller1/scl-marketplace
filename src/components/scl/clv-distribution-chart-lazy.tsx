"use client";

import dynamic from "next/dynamic";

import type { ClvTrackerSummary } from "@/lib/clv-tracker";

const ClvDistributionChart = dynamic(
  () =>
    import("@/components/scl/clv-distribution-chart").then(
      (mod) => mod.ClvDistributionChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="bg-surface-2 h-44 w-full animate-pulse rounded-[10px]"
        aria-hidden
      />
    ),
  },
);

/** Client island so `next/dynamic` + `ssr: false` is valid under Next 16. */
export function ClvDistributionChartLazy({
  summary,
  embedded = false,
  className,
}: {
  summary: ClvTrackerSummary;
  embedded?: boolean;
  className?: string;
}) {
  return (
    <ClvDistributionChart
      summary={summary}
      embedded={embedded}
      className={className}
    />
  );
}
