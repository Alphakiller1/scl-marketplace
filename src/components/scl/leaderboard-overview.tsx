import { Trophy } from "lucide-react";

import { VerificationHelpLink } from "@/components/scl/verification-help-link";

export function LeaderboardOverview() {
  return (
    <header className="scl-section-mark pt-3 sm:pt-4">
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
          Tracked public records ranked within the scope you choose. Submission
          verification and provisional samples remain visible.
        </p>
      </div>
    </header>
  );
}
