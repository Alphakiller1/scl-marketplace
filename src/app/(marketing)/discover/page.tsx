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
  const { lanes, failed } = await getDiscoverLanes();
  const filledLanes = lanes.filter((lane) => lane.entries.length > 0);
  const emptyLanes = lanes.filter((lane) => lane.entries.length === 0);

  return (
    <main
      className="mx-auto max-w-[1400px] min-w-0 px-4 py-4 sm:px-6 sm:py-5 lg:px-8"
      data-visual-mode="rank"
    >
      <DiscoverOverview />
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
        <div className="scl-section-mark">
          <p className="scl-eyebrow text-[color:var(--scl-muted-data)]">
            Public Directory
          </p>
          <h2
            id="discover-directory-handoff"
            className="scl-display text-foreground mt-1 text-xl font-semibold"
          >
            Need Every Public Record?
          </h2>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
            The Leaderboard separates ranked records from cappers still building
            a record.
          </p>
        </div>
        <Button
          render={<Link href="/leaderboard" />}
          nativeButton={false}
          variant="nav"
          className="min-h-10 shrink-0 gap-2"
        >
          Open Leaderboard
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </section>
    </main>
  );
}
