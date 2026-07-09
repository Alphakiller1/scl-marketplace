import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListChecks } from "lucide-react";

import { formatRoi, formatUnits } from "@/lib/format";
import { getPublicCapperByHandle } from "@/lib/queries/capper";
import { CapperProfileHeader } from "@/components/scl/capper-profile-header";
import { CapperStorefront } from "@/components/scl/capper-storefront";
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
  if (!data) return { title: "Capper Not Found" };

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

  const { capper, plays, playsError } = data;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <CapperProfileHeader capper={capper} />

      <div className="mt-5">
        <PerformanceSummary capper={capper} />
      </div>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section id="recent-picks" className="scroll-mt-20">
          <SectionHeader
            icon={ListChecks}
            title="Recent Positions"
            subtitle="Latest tracked plays and parlays, newest first"
          />
          {plays.length ? (
            <div className="mt-4 space-y-2">
              {plays.map((play) => (
                <PlayListItem key={play.id} play={play} />
              ))}
            </div>
          ) : playsError ? (
            <EmptyState
              className="mt-4"
              icon={ListChecks}
              title="Couldn't Load Recent Positions"
              description="We hit a snag loading this capper's tracked positions. Please try again shortly."
            />
          ) : (
            <EmptyState
              className="mt-4"
              icon={ListChecks}
              title="No Tracked Positions Yet"
              description={`${capper.name} hasn't posted any tracked plays or parlays yet.`}
            />
          )}
        </section>

        {capper.storefront ? (
          <aside className="border-border border-t pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
            <CapperStorefront
              className="mt-0"
              storefront={capper.storefront}
              capperName={capper.name}
            />
          </aside>
        ) : null}
      </div>
    </div>
  );
}
