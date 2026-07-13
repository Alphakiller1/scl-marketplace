import type { Metadata } from "next";
import { Zap } from "lucide-react";

import { SectionHeader } from "@/components/scl/section";
import { PickCard } from "@/components/scl/pick-card";
import { EmptyState } from "@/components/scl/states";
import { getLeaderboardResult } from "@/lib/queries/leaderboard";
import { getPublicRecentPicksResult } from "@/lib/queries/plays";
import { publicFeedCappers } from "@/lib/public-picks";

export const metadata: Metadata = {
  title: "Today's Picks",
  description: "Live and pending plays from active sports cappers.",
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
  const failed = leaderboardFailed || picksFailed;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <SectionHeader
        icon={Zap}
        title="Latest Picks"
        subtitle="Recent tracked submissions from active cappers"
      />
      {picks.length ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {picks.map((pick) => (
            <PickCard key={pick.id} pick={pick} />
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
              : "Recent tracked submissions will appear here after active cappers post plays."
          }
        />
      )}
    </div>
  );
}
