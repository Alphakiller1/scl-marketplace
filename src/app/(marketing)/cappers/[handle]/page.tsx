import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListChecks } from "lucide-react";

import { formatRoi, formatUnits } from "@/lib/format";
import { getPublicCapperByHandle } from "@/lib/queries/capper";
import { CapperProfileHeader } from "@/components/scl/capper-profile-header";
import { PerformanceSummary } from "@/components/scl/performance-summary";
import { PlayListItem } from "@/components/scl/play-list-item";
import { SectionHeader } from "@/components/scl/section";
import { EmptyState } from "@/components/scl/states";

type ProfileParams = { params: Promise<{ handle: string }> };

export const revalidate = 60;

export async function generateMetadata({
  params,
}: ProfileParams): Promise<Metadata> {
  const { handle } = await params;
  const data = await getPublicCapperByHandle(handle);
  if (!data) return { title: "Capper not found" };

  const { capper } = data;
  const description =
    capper.headline ??
    `${capper.name} — ${capper.topSport} handicapper on SCL. ${capper.winPct.toFixed(1)}% win rate, ${formatUnits(capper.units)} (${formatRoi(capper.roi)} ROI).`;

  return { title: `${capper.name} (@${capper.handle})`, description };
}

export default async function CapperProfilePage({ params }: ProfileParams) {
  const { handle } = await params;
  const data = await getPublicCapperByHandle(handle);
  if (!data) notFound();

  const { capper, plays } = data;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <CapperProfileHeader capper={capper} />

      <div className="mt-5">
        <PerformanceSummary capper={capper} />
      </div>

      <section id="recent-picks" className="mt-8 scroll-mt-20">
        <SectionHeader
          icon={ListChecks}
          title="Recent plays"
          subtitle="Latest tracked plays, newest first"
        />
        {plays.length ? (
          <div className="mt-4 space-y-2">
            {plays.map((p) => (
              <PlayListItem key={p.id} play={p} />
            ))}
          </div>
        ) : (
          <EmptyState
            className="mt-4"
            icon={ListChecks}
            title="No tracked plays yet"
            description={`${capper.name} hasn't posted any graded plays yet.`}
          />
        )}
      </section>
    </div>
  );
}
