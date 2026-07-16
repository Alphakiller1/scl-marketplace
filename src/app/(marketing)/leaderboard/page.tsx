import type { Metadata } from "next";

import {
  BuildingRecordSection,
  Leaderboard,
} from "@/components/scl/leaderboard";
import { LeaderboardFilters } from "@/components/scl/leaderboard-filters";
import { LeaderboardOverview } from "@/components/scl/leaderboard-overview";
import {
  parseLeaderboardFilters,
  summarizeLeaderboard,
} from "@/lib/leaderboard";
import { getLeaderboardResult } from "@/lib/queries/leaderboard";

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "Sports capper leaderboard records ranked by units, ROI, and win rate after sample thresholds. Inspect building records while the founding roster forms.",
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
    <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
      <LeaderboardOverview summary={summary} />
      <LeaderboardFilters filters={filters} />
      <section aria-label="Ranked Cappers" className="mt-5 sm:mt-6">
        <Leaderboard
          cappers={cappers}
          failed={failed}
          emptyDescription="No cappers match these ranking filters yet. Cappers below the sample threshold or net-negative in this scope appear under Building A Record."
        />
      </section>
      <BuildingRecordSection cappers={unranked} failed={failed} />
    </div>
  );
}
