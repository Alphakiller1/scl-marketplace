import {
  ChartNoAxesCombined,
  ListChecks,
  ShieldCheck,
  Trophy,
} from "lucide-react";

import type { LeaderboardSummary } from "@/lib/leaderboard";
import { formatRoi } from "@/lib/format";
import { StatValue } from "@/components/scl/stat-value";

export function LeaderboardOverview({
  summary,
}: {
  summary: LeaderboardSummary;
}) {
  return (
    <header>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="border-t border-[color:var(--scl-gold-deep)] pt-2.5">
          <div className="scl-eyebrow flex items-center gap-2 text-[color:var(--scl-muted-label)]">
            <Trophy className="size-4" aria-hidden />
            Public Rankings
          </div>
          <h1 className="scl-display mt-2 text-3xl font-bold tracking-[0.04em] text-balance uppercase sm:text-4xl">
            Leaderboard
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Compare tracked records by units, ROI, win rate, sport, time window,
            and sample size.
          </p>
        </div>
        <p className="text-muted-foreground max-w-sm text-sm sm:text-right">
          Rankings recalculate from graded plays. Filter scope changes every
          result on this page.
        </p>
      </div>

      <dl className="border-border mt-6 grid grid-cols-2 border-y sm:grid-cols-4">
        <OverviewMetric
          icon={Trophy}
          label="Ranked Cappers"
          value={summary.rankedCappers.toLocaleString()}
        />
        <OverviewMetric
          icon={ShieldCheck}
          label="Verified"
          value={summary.verifiedCappers.toLocaleString()}
        />
        <OverviewMetric
          icon={ListChecks}
          label="Graded Picks"
          value={summary.trackedPicks.toLocaleString()}
        />
        <OverviewMetric
          icon={ChartNoAxesCombined}
          label="Scope ROI"
          value={summary.trackedPicks ? formatRoi(summary.roi) : "—"}
        />
      </dl>
    </header>
  );
}

function OverviewMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="border-border flex min-h-20 items-center gap-2.5 border-r px-2.5 py-3 last:border-r-0 sm:min-h-24 sm:gap-3 sm:px-5 sm:py-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[color:var(--scl-ink-700)] text-[color:var(--scl-muted-data)] sm:size-9">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <dt className="text-muted-foreground truncate text-[0.7rem] font-semibold uppercase">
          {label}
        </dt>
        <dd>
          <StatValue tone="text" className="text-xl font-bold sm:text-2xl">
            {value}
          </StatValue>
        </dd>
      </div>
    </div>
  );
}
