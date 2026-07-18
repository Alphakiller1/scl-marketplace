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
      <div className="border-t border-[color:var(--scl-pink-deep)] pt-2">
        <div className="scl-eyebrow flex items-center gap-2 text-[color:var(--scl-muted-label)]">
          <Trophy className="size-3.5" aria-hidden />
          Public Rankings
        </div>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="scl-display text-2xl font-bold tracking-[0.04em] sm:text-3xl">
            Leaderboard
          </h1>
          <VerificationHelpLink />
        </div>
        <p className="text-muted-foreground mt-1.5 max-w-3xl text-sm leading-snug">
          Ranked by net units on board-verified graded plays. Filter by sport,
          window, and sample size — provisional rows are still building a
          record.
        </p>
      </div>

      <dl className="border-border mt-3 grid grid-cols-2 border-y sm:grid-cols-4">
        <OverviewMetric
          icon={Trophy}
          label={
            summary.rankedCappers === 1 ? "Ranked capper" : "Ranked cappers"
          }
          value={summary.rankedCappers.toLocaleString()}
        />
        <OverviewMetric
          icon={ShieldCheck}
          label="Verified"
          value={summary.verifiedCappers.toLocaleString()}
        />
        <OverviewMetric
          icon={ListChecks}
          label={summary.trackedPicks === 1 ? "Graded pick" : "Graded picks"}
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
    <div className="border-border flex min-h-14 items-center gap-2 border-r px-2.5 py-2 last:border-r-0 sm:min-h-16 sm:gap-2.5 sm:px-4 sm:py-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[color:var(--scl-ink-700)] text-[color:var(--scl-muted-data)] sm:size-8">
        <Icon className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0">
        <dt className="scl-eyebrow truncate text-[color:var(--scl-muted-label)]">
          {label}
        </dt>
        <dd>
          <StatValue tone="text" className="text-lg font-bold sm:text-xl">
            {value}
          </StatValue>
        </dd>
      </div>
    </div>
  );
}
