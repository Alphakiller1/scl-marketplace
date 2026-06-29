import type { Metadata } from "next";
import { Users } from "lucide-react";

import { CapperCard } from "@/components/scl/capper-card";
import { EmptyState } from "@/components/scl/states";
import { LeaderboardFilters } from "@/components/scl/leaderboard-filters";
import { parseLeaderboardFilters } from "@/lib/leaderboard";
import { getLeaderboardResult } from "@/lib/queries/leaderboard";

export const metadata: Metadata = {
  title: "Cappers",
  description:
    "Discover verified sports handicappers by record, ROI, and form.",
};

export const revalidate = 60;

export default async function CappersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseLeaderboardFilters(await searchParams);
  const { cappers, failed } = await getLeaderboardResult(filters);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-brand flex items-center gap-2 text-xs font-semibold uppercase">
            <Users className="size-4" aria-hidden />
            Capper directory
          </div>
          <h1 className="mt-2 text-3xl font-bold text-balance sm:text-4xl">
            Find a track record worth following
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Compare performance, sample size, recent form, specialties, and
            public storefronts.
          </p>
        </div>
        <p className="nums text-muted-foreground tabular-nums">
          <span className="text-foreground text-2xl font-bold">
            {cappers.length}
          </span>{" "}
          {cappers.length === 1 ? "result" : "results"}
        </p>
      </header>
      <LeaderboardFilters
        filters={filters}
        action="/cappers"
        label="Discovery filters"
      />
      {cappers.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={Users}
          title={failed ? "Couldn't load the directory" : "No cappers found"}
          description={
            failed
              ? "Public capper records are temporarily unavailable. Please try again shortly."
              : "Broaden the filters or reduce the minimum sample to discover more public records."
          }
        />
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cappers.map((capper) => (
            <CapperCard key={capper.id} capper={capper} rank={capper.rank} />
          ))}
        </div>
      )}
    </div>
  );
}
