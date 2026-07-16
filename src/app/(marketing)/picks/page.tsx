import type { Metadata } from "next";
import { Zap } from "lucide-react";

import { SectionHeader } from "@/components/scl/section";
import { PickCard } from "@/components/scl/pick-card";
import { EmptyState } from "@/components/scl/states";
import { VerificationHelpLink } from "@/components/scl/verification-help-link";
import { VerificationLegend } from "@/components/scl/verification-legend";
import { getGradingHealth } from "@/lib/grading-health";
import { getLeaderboardResult } from "@/lib/queries/leaderboard";
import { getPublicRecentPicksResult } from "@/lib/queries/plays";
import { publicFeedCappers } from "@/lib/public-picks";

export const metadata: Metadata = {
  title: { absolute: "Today's Picks · SCL" },
  description:
    "Recent tracked picks with sportsbook source attribution and grading status. Inspect receipts — no hype.",
};

export const revalidate = 60;

export default async function PicksPage() {
  const {
    cappers,
    unranked,
    failed: leaderboardFailed,
  } = await getLeaderboardResult();
  const { picks, failed: picksFailed } = await getPublicRecentPicksResult(
    publicFeedCappers(cappers, unranked),
    24,
  );
  const gradingHealthy = await getGradingHealth();
  const failed = leaderboardFailed || picksFailed;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeader
          icon={Zap}
          title="Latest Picks"
          subtitle="Recent public Tickets — board-verified when odds were checked pre-game"
        />
        <VerificationHelpLink className="text-muted-foreground hover:text-foreground inline-flex min-h-11 shrink-0 gap-1.5 self-start px-2 text-xs font-medium" />
      </div>
      <VerificationLegend className="mt-4" />
      {picks.length ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {picks.map((pick) => (
            <PickCard
              key={pick.id}
              pick={pick}
              gradingHealthy={gradingHealthy}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-6"
          icon={Zap}
          title={failed ? "Couldn't load public picks" : "No public picks yet"}
          description={
            failed
              ? "Recent tracked submissions are temporarily unavailable. Please try again shortly."
              : "Public Tickets appear here after cappers log board-checked plays. Nothing is fabricated to fill the feed."
          }
        />
      )}
    </div>
  );
}
