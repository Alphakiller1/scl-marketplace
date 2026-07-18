import {
  ChartNoAxesCombined,
  ListChecks,
  ShieldCheck,
  Trophy,
} from "lucide-react";

import type { LeaderboardSummary } from "@/lib/leaderboard";
import { formatRoi } from "@/lib/format";
import { StatValue } from "@/components/scl/stat-value";
import { VerificationHelpLink } from "@/components/scl/verification-help-link";

export function LeaderboardOverview({
  summary,
}: {
  summary: LeaderboardSummary;
}) {
  return (
    <header>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="border-t border-[color:var(--scl-pink-deep)] pt-2.5">
          <div className="scl-eyebrow flex items-center gap-2 text-[color:var(--scl-muted-label)]">
            <Trophy className="size-4" aria-hidden />
            Rank mode
          </div>
          <h1 className="scl-display mt-2 text-3xl font-bold tracking-[0.02em] text-balance sm:text-4xl">
            Leaderboard
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed sm:text-base">
            Compare scoped performance records with sample maturity and
            submission verification visible in every row.
          </p>
          <div className="mt-2">
            <VerificationHelpLink />
          </div>
        </div>
        <p className="text-muted-foreground max-w-sm text-sm leading-relaxed sm:text-right">
          Early samples are labeled provisional. They are new records, not
          performance conclusions.
        </p>
      </div>

      <dl className="border-border mt-6 grid grid-cols-2 border-y sm:grid-cols-4">
        <OverviewMetric
          icon={Trophy}
          label="Ranked cappers"
          value={summary.rankedCappers.toLocaleString()}
        />
        <OverviewMetric
          icon={ShieldCheck}
          label="Board-verified"
          value={summary.verifiedCappers.toLocaleString()}
        />
        <OverviewMetric
          icon={ListChecks}
          label="Graded picks"
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
