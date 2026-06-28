import type { Metadata } from "next";
import { Users } from "lucide-react";

import { SectionHeader } from "@/components/scl/section";
import { CapperCard } from "@/components/scl/capper-card";
import { EmptyState } from "@/components/scl/states";
import { getLeaderboard } from "@/lib/queries/leaderboard";

export const metadata: Metadata = {
  title: "Cappers",
  description:
    "Discover verified sports handicappers by record, ROI, and form.",
};

export const revalidate = 60;

export default async function CappersPage() {
  const cappers = await getLeaderboard();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <SectionHeader
        icon={Users}
        title="Cappers"
        subtitle="Discover verified handicappers by record, ROI, and form"
      />
      {cappers.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={Users}
          title="No cappers yet"
          description="Verified handicappers will appear here as they join and post tracked plays."
        />
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cappers.map((c) => (
            <CapperCard key={c.id} capper={c} rank={c.rank} />
          ))}
        </div>
      )}
    </div>
  );
}
