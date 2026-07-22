import { Trophy } from "lucide-react";

import { VerificationHelpLink } from "@/components/scl/verification-help-link";
import type { LeaderboardSummary } from "@/lib/leaderboard";

export function LeaderboardOverview({
  summary,
}: {
  summary: LeaderboardSummary;
}) {
  return (
    <header className="scl-section-mark pt-3 sm:pt-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <div className="scl-eyebrow flex items-center gap-2 text-[color:var(--scl-muted-data)]">
            <Trophy
              className="size-3.5 text-[color:var(--scl-blue)]"
              aria-hidden
            />
            Public rankings
          </div>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="scl-page-title">Leaderboard</h1>
            <VerificationHelpLink />
          </div>
          <p className="text-muted-foreground mt-2 max-w-3xl text-base leading-relaxed">
            Tracked public records ranked within the scope you choose.
            Submission verification and provisional samples remain visible.
          </p>
        </div>

        <dl className="hidden shrink-0 grid-cols-2 gap-2 sm:grid">
          <CompactMetric
            label={
              summary.rankedCappers === 1 ? "Ranked capper" : "Ranked cappers"
            }
            value={summary.rankedCappers.toLocaleString()}
          />
          <CompactMetric
            label={summary.trackedPicks === 1 ? "Graded pick" : "Graded picks"}
            value={summary.trackedPicks.toLocaleString()}
          />
        </dl>
      </div>
    </header>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border min-w-28 overflow-hidden rounded-[12px] border bg-[linear-gradient(165deg,color-mix(in_srgb,var(--scl-ink-700)_88%,#fff_4%)_0%,var(--scl-ink-800)_100%)] px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <dt className="scl-eyebrow text-[color:var(--scl-muted-data)]">
        {label}
      </dt>
      <dd className="scl-data text-lg font-bold tabular-nums">{value}</dd>
    </div>
  );
}
