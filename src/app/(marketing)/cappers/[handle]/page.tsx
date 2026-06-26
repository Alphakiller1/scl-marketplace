import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListChecks } from "lucide-react";

import { MOCK_CAPPERS, getCapperByHandle, getCapperPicks } from "@/lib/mock";
import { formatRoi, formatUnits } from "@/lib/format";
import { CapperProfileHeader } from "@/components/scl/capper-profile-header";
import { PerformanceSummary } from "@/components/scl/performance-summary";
import { PickCard } from "@/components/scl/pick-card";
import { SectionHeader } from "@/components/scl/section";
import { EmptyState } from "@/components/scl/states";

type ProfileParams = { params: Promise<{ handle: string }> };

export function generateStaticParams() {
  return MOCK_CAPPERS.map((c) => ({ handle: c.handle }));
}

export async function generateMetadata({
  params,
}: ProfileParams): Promise<Metadata> {
  const { handle } = await params;
  const capper = getCapperByHandle(handle);
  if (!capper) return { title: "Capper not found" };

  const description =
    capper.headline ??
    `${capper.name} — ${capper.topSport} handicapper on SCL. ${capper.winPct.toFixed(1)}% win rate, ${formatUnits(capper.units)} (${formatRoi(capper.roi)} ROI).`;

  return {
    title: `${capper.name} (@${capper.handle})`,
    description,
  };
}

export default async function CapperProfilePage({ params }: ProfileParams) {
  const { handle } = await params;
  const capper = getCapperByHandle(handle);
  if (!capper) notFound();

  const picks = getCapperPicks(capper.id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <CapperProfileHeader capper={capper} />

      <div className="mt-5">
        <PerformanceSummary capper={capper} />
      </div>

      <section id="recent-picks" className="mt-8 scroll-mt-20">
        <SectionHeader
          icon={ListChecks}
          title="Recent picks"
          subtitle="Latest tracked plays (preview data)"
        />
        {picks.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {picks.map((p) => (
              <PickCard key={p.id} pick={p} />
            ))}
          </div>
        ) : (
          <EmptyState
            className="mt-4"
            icon={ListChecks}
            title="No recent picks"
            description={`${capper.name} hasn't posted any tracked plays yet.`}
          />
        )}
      </section>
    </div>
  );
}
