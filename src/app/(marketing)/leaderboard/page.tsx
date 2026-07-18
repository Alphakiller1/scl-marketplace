import type { Metadata } from "next";

import { CompareTray } from "@/components/scl/compare-tray";
import {
  BuildingRecordSection,
  Leaderboard,
} from "@/components/scl/leaderboard";
import { LeaderboardFilters } from "@/components/scl/leaderboard-filters";
import { LeaderboardOverview } from "@/components/scl/leaderboard-overview";
import { LeaderboardRankingRail } from "@/components/scl/leaderboard-ranking-rail";
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
    <div
      className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6 sm:py-5"
      data-visual-mode="rank"
    >
      <LeaderboardOverview summary={summary} />
      <LeaderboardFilters filters={filters} />

      {/* Wide desktop: ~10/2 — main board + ~236px explanation rail */}
      <div className="mt-3 grid gap-4 lg:mt-4 lg:grid-cols-[minmax(0,1fr)_14.75rem] lg:gap-5">
        <section aria-label="Ranked cappers" className="min-w-0">
          <Leaderboard
            cappers={cappers}
            filters={filters}
            showExpand
            failed={failed}
            emptyDescription="No cappers meet the selected ranking filters. Records below the sample threshold or with negative ROI or units remain visible under Building a Record."
          />
        </section>
        <div className="min-w-0">
          <LeaderboardRankingRail className="lg:sticky lg:top-24" />
        </div>
      </div>

      <BuildingRecordSection cappers={unranked} failed={failed} />
      <CompareTray />
      {/* Spacer so compare tray does not cover Building a Record on mobile */}
      <div className="h-16" aria-hidden />
    </div>
  );
}
