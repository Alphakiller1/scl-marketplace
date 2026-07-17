import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListChecks } from "lucide-react";

import { identityDisplayLinesFromCapper } from "@/lib/identity";
import { buildCapperProfileMetadata } from "@/lib/capper-profile-seo";
import { getPublicCapperByHandle } from "@/lib/queries/capper";
import { getLivePackagesForCapper } from "@/lib/queries/store";
import { CapperProfileHeader } from "@/components/scl/capper-profile-header";
import { CapperStorefront } from "@/components/scl/capper-storefront";
import { PerformanceSummary } from "@/components/scl/performance-summary";
import { PlayListItem } from "@/components/scl/play-list-item";
import { SectionHeader } from "@/components/scl/section";
import { EmptyState } from "@/components/scl/states";
import { VerificationHelpLink } from "@/components/scl/verification-help-link";
import { VerificationLegend } from "@/components/scl/verification-legend";

type ProfileParams = { params: Promise<{ handle: string }> };

export const revalidate = 60;

export async function generateMetadata({
  params,
}: ProfileParams): Promise<Metadata> {
  const { handle } = await params;
  const data = await getPublicCapperByHandle(handle);
  if (!data) return { title: "Capper Not Found" };
  return buildCapperProfileMetadata(data.capper);
}

export default async function CapperProfilePage({ params }: ProfileParams) {
  const { handle } = await params;
  const data = await getPublicCapperByHandle(handle);
  if (!data) notFound();

  const { capper, plays, playsError, avgClv } = data;
  const identity = identityDisplayLinesFromCapper(capper);
  const packages = await getLivePackagesForCapper(capper.id);

  return (
    <div className="overflow-x-hidden pb-6 sm:pb-8">
      {/* Header owns its own full-bleed cover + constrained identity column. */}
      <CapperProfileHeader capper={capper} />

      <div className="mx-auto mt-5 max-w-5xl px-4 sm:px-6">
        <PerformanceSummary capper={capper} avgClv={avgClv} />

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section id="recent-picks" className="scroll-mt-20">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <SectionHeader
                icon={ListChecks}
                title="Recent Plays"
                subtitle="Inspectable Tickets — newest first. Verified ≠ Won."
              />
              <VerificationHelpLink className="text-muted-foreground hover:text-foreground inline-flex min-h-11 shrink-0 gap-1.5 self-start px-2 text-xs font-medium" />
            </div>
            {plays.length ? (
              <>
                <VerificationLegend className="mt-4" />
                <div className="mt-3 space-y-2">
                  {plays.map((play) => (
                    <PlayListItem key={play.id} play={play} />
                  ))}
                </div>
              </>
            ) : playsError ? (
              <EmptyState
                className="mt-4"
                icon={ListChecks}
                title="Couldn't Load Recent Plays"
                description="We hit a snag loading this capper's plays. Please try again shortly."
              />
            ) : (
              <EmptyState
                className="mt-4"
                icon={ListChecks}
                title="No Tracked Plays Yet"
                description={`${identity.primary} hasn't posted any graded plays yet. Every new play will stay inspectable here — timestamps, lines, and results included.`}
              />
            )}
          </section>

          <aside className="border-border border-t pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
            <CapperStorefront
              className="mt-0"
              storefront={capper.storefront}
              capperName={identity.primary}
              packages={packages}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
