import type { Metadata } from "next";

import { BuildingRecordSection } from "@/components/scl/leaderboard";
import { LeaderboardFilters } from "@/components/scl/leaderboard-filters";
import { LeaderboardOverview } from "@/components/scl/leaderboard-overview";
import { LeaderboardRankView } from "@/components/scl/leaderboard-rank-view";
import { LeaderboardContextRail } from "@/components/scl/leaderboard-context-rail";
import {
  parseLeaderboardFilters,
  summarizeLeaderboard,
} from "@/lib/leaderboard";
import { getLeaderboardResult } from "@/lib/queries/leaderboard";

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "Scoped sports capper rankings with ROI, Units, sample maturity, board-verification share, and recent form.",
};

// Live data, cached briefly so the public board stays fresh without hammering DB.
export const revalidate = 60;

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseLeaderboardFilters(await searchParams);
  const { cappers, unranked, failed } = await getLeaderboardResult(filters);
  const summary = summarizeLeaderboard(cappers, unranked);

  return (
    <div className="mx-auto max-w-[90rem] px-4 py-7 sm:px-6 sm:py-10">
      <LeaderboardOverview summary={summary} />
      <LeaderboardFilters filters={filters} />
      <div className="mt-5 grid items-start gap-4 sm:mt-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-label="Ranked cappers" className="min-w-0">
          <LeaderboardRankView
            cappers={cappers}
            filters={filters}
            failed={failed}
          />
        </section>
        <LeaderboardContextRail filters={filters} />
      </div>
      <BuildingRecordSection
        cappers={unranked}
        failed={failed}
        minPicks={filters.minPicks}
      />
    </div>
  );
}
