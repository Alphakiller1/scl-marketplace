import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { DiscoverEmptyLanesIndex } from "@/components/scl/discover-empty-lanes-index";
import { DiscoverLaneIndex } from "@/components/scl/discover-lane-index";
import { DiscoverLaneSection } from "@/components/scl/discover-lane-section";
import { DiscoverOverview } from "@/components/scl/discover-overview";
import { Button } from "@/components/ui/button";
import { getDiscoverLanes } from "@/lib/queries/discover";

export const metadata: Metadata = {
  title: "Discover",
  description:
    "Explore cappers through evidence-based views of record, verification, specialization, and pricing.",
};

export const revalidate = 60;

export default async function DiscoverPage() {
  const { lanes, publicRecordCount, failed } = await getDiscoverLanes();
  const filledLanes = lanes.filter((lane) => lane.entries.length > 0);
  const emptyLanes = lanes.filter((lane) => lane.entries.length === 0);

  return (
    <main
      className="mx-auto max-w-[1400px] overflow-x-hidden px-4 py-4 sm:px-6 sm:py-5 lg:px-8"
      data-visual-mode="rank"
    >
      <DiscoverOverview
        matchedLaneCount={filledLanes.length}
        totalLaneCount={lanes.length}
        publicRecordCount={publicRecordCount}
        failed={failed}
      />
      <DiscoverLaneIndex lanes={lanes} failed={failed} />

      <div className="mt-7 space-y-9">
        {filledLanes.map((lane) => (
          <DiscoverLaneSection
            key={lane.id}
            lane={lane}
            index={lanes.findIndex((candidate) => candidate.id === lane.id)}
            failed={failed}
          />
        ))}
        <DiscoverEmptyLanesIndex lanes={emptyLanes} failed={failed} />
      </div>

      <section
        className="border-border mt-10 flex flex-col gap-4 border-y py-6 sm:flex-row sm:items-center sm:justify-between"
        aria-labelledby="discover-directory-handoff"
      >
        <div>
          <p className="scl-eyebrow text-[color:var(--scl-muted-data)]">
            Public directory
          </p>
          <h2
            id="discover-directory-handoff"
            className="scl-display text-foreground mt-1 text-xl font-semibold"
          >
            Need every public record?
          </h2>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
            The Leaderboard separates ranked records from cappers still building
            a record.
          </p>
        </div>
        <Button
          render={<Link href="/leaderboard" />}
          nativeButton={false}
          className="min-h-11 gap-2 border-[color:var(--scl-blue)] bg-[color:var(--scl-blue)] text-[color:var(--scl-blue-ink)] hover:bg-[color:var(--scl-blue)]/90"
        >
          Open leaderboard
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </section>
    </main>
  );
}
