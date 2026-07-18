import type { Metadata } from "next";
import { Compass, Users } from "lucide-react";

import { CapperCard } from "@/components/scl/capper-card";
import { DiscoverLaneSection } from "@/components/scl/discover-lane-section";
import { EmptyState } from "@/components/scl/states";
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

const INTRO =
  "Explore cappers through evidence-based views of record, verification, specialization, and pricing.";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseLeaderboardFilters(await searchParams);
  const [{ lanes, failed: lanesFailed }, { cappers, unranked, failed }] =
    await Promise.all([getDiscoverLanes(), getLeaderboardResult(filters)]);
  const results = [...cappers, ...unranked];

  return (
    <div
      className="mx-auto max-w-6xl overflow-x-hidden px-4 py-7 sm:px-6 sm:py-10"
      data-visual-mode="rank"
    >
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="scl-display flex items-center gap-2.5 text-3xl font-bold tracking-[0.03em] text-balance sm:text-4xl">
            <Compass
              className="size-7 shrink-0 text-[color:var(--scl-blue)] sm:size-8"
              aria-hidden
            />
            Discover
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed sm:text-base">
            {INTRO}
          </p>
        </div>
      </header>

      <div className="mt-8 space-y-10">
        {lanes.map((lane) => (
          <DiscoverLaneSection key={lane.id} lane={lane} failed={lanesFailed} />
        ))}
      </div>

      <section className="mt-12 space-y-4" aria-labelledby="discover-browse">
        <div className="border-border border-t pt-6">
          <h2
            id="discover-browse"
            className="scl-display text-lg font-bold tracking-[0.04em] uppercase"
          >
            Browse all public records
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Filter and sort the full directory after the curated lanes.
          </p>
        </div>
        <LeaderboardFilters filters={filters} action="/discover" />
        {results.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={Users}
            title={failed ? "Couldn't Load The Directory" : "No Cappers Found"}
            description={
              failed
                ? "Public capper records are temporarily unavailable. Please try again shortly."
                : "Broaden the filters or reduce the minimum sample to discover more public records."
            }
          />
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((capper) => (
              <CapperCard key={capper.id} capper={capper} rank={capper.rank} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
