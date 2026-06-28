import type { Metadata } from "next";
import { Trophy } from "lucide-react";

import { SectionHeader } from "@/components/scl/section";
import {
  LeaderboardRow,
  LeaderboardMobileCard,
} from "@/components/scl/leaderboard-row";
import { EmptyState } from "@/components/scl/states";
import { getLeaderboard } from "@/lib/queries/leaderboard";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "Verified sports cappers ranked by units, ROI, and win rate.",
};

// Live data, cached briefly so the public board stays fresh without hammering DB.
export const revalidate = 60;

export default async function LeaderboardPage() {
  const cappers = await getLeaderboard();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <SectionHeader
        icon={Trophy}
        title="Leaderboard"
        subtitle="Verified records, ranked by units won"
      />

      {cappers.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={Trophy}
          title="No ranked cappers yet"
          description="As cappers post graded plays, the leaderboard ranks them by units won, ROI, and win rate."
        />
      ) : (
        <>
          <div className="mt-6 hidden md:block">
            <div className="text-muted-foreground grid grid-cols-[2.5rem_1fr_5rem_5rem_5rem_8rem] gap-3 px-3 pb-1 text-[0.7rem] font-medium tracking-wide uppercase">
              <span>#</span>
              <span>Capper</span>
              <span className="text-right">Win %</span>
              <span className="text-right">Units</span>
              <span className="text-right">ROI</span>
              <span className="text-right">Form</span>
            </div>
            <div className="space-y-0.5">
              {cappers.map((c) => (
                <LeaderboardRow key={c.id} capper={c} rank={c.rank} />
              ))}
            </div>
          </div>
          <div className="mt-6 space-y-2 md:hidden">
            {cappers.map((c) => (
              <LeaderboardMobileCard key={c.id} capper={c} rank={c.rank} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
