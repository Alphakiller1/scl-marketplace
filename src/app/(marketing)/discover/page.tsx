import type { Metadata } from "next";

import { CompareTray } from "@/components/scl/compare-tray";
import { DiscoverEmptyLanesIndex } from "@/components/scl/discover-empty-lanes-index";
import { DiscoverLaneIndex } from "@/components/scl/discover-lane-index";
import { DiscoverLaneSection } from "@/components/scl/discover-lane-section";
import { DiscoverOverview } from "@/components/scl/discover-overview";
import {
  BuildingRecordSection,
  Leaderboard,
} from "@/components/scl/leaderboard";
import { LeaderboardFilters } from "@/components/scl/leaderboard-filters";
import { parseLeaderboardFilters } from "@/lib/leaderboard";
import { getDiscoverLanes } from "@/lib/queries/discover";
import { getLeaderboardResult } from "@/lib/queries/leaderboard";

export const metadata: Metadata = {
  title: "Discover",
  description:
    "Explore cappers through evidence-based views of record, verification, specialization, and pricing.",
};

export const revalidate = 60;

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseLeaderboardFilters(await searchParams);
  const [{ lanes, failed: lanesFailed }, { cappers, unranked, failed }] =
    await Promise.all([getDiscoverLanes(), getLeaderboardResult(filters)]);
  const filledLanes = lanes.filter((lane) => lane.entries.length > 0);
  const emptyLanes = lanes.filter((lane) => lane.entries.length === 0);

  return (
    <div
      className="mx-auto max-w-[1400px] overflow-x-hidden px-4 py-4 sm:px-6 sm:py-5 lg:px-8"
      data-visual-mode="rank"
    >
      <DiscoverOverview
        laneCount={lanes.length}
        publicRecordCount={cappers.length + unranked.length}
      />
      <DiscoverLaneIndex lanes={lanes} />

      {/* Each lane renders once; empty lanes share one compact, honest index. */}
      <div className="mt-7 space-y-9">
        {filledLanes.map((lane) => (
          <DiscoverLaneSection key={lane.id} lane={lane} failed={lanesFailed} />
        ))}
        <DiscoverEmptyLanesIndex lanes={emptyLanes} failed={lanesFailed} />
      </div>

      <section className="mt-10 space-y-4" aria-labelledby="discover-browse">
        <div className="border-border border-t pt-6">
          <h2
            id="discover-browse"
            className="scl-display text-lg font-bold tracking-[0.04em] uppercase"
          >
            Browse all public records
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Filter and sort every publicly listed capper record.
          </p>
        </div>
        <LeaderboardFilters filters={filters} action="/discover" />
        <div className="mt-4">
          <Leaderboard
            cappers={cappers}
            filters={filters}
            showExpand
            failed={failed}
            basePath="/discover"
            emptyTitle="No ranked records in this scope"
            emptyDescription="Broaden the filters or reduce the minimum sample to inspect more public records."
          />
        </div>
        <BuildingRecordSection cappers={unranked} failed={failed} />
      </section>
      <CompareTray />
      <div className="h-16" aria-hidden />
    </div>
  );
}
