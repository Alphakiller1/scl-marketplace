import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListChecks } from "lucide-react";

import { appUrl } from "@/lib/app-url";
import { formatRoi, formatUnits } from "@/lib/format";
import { formatHandle, identityDisplayLinesFromCapper } from "@/lib/identity";
import { getPublicCapperByHandle } from "@/lib/queries/capper";
import { CapperProfileHeader } from "@/components/scl/capper-profile-header";
import { CapperStorefront } from "@/components/scl/capper-storefront";
import { PerformanceSummary } from "@/components/scl/performance-summary";
import { PlayListItem } from "@/components/scl/play-list-item";
import { SectionHeader } from "@/components/scl/section";
import { EmptyState } from "@/components/scl/states";
import { VerificationLegend } from "@/components/scl/verification-legend";

type ProfileParams = { params: Promise<{ handle: string }> };

export const revalidate = 60;

export async function generateMetadata({
  params,
}: ProfileParams): Promise<Metadata> {
  const { handle } = await params;
  const data = await getPublicCapperByHandle(handle);
  if (!data) return { title: "Capper Not Found" };

  const { capper } = data;
  const identity = identityDisplayLinesFromCapper(capper);
  const handleLabel = formatHandle(capper.handle);
  const description =
    capper.headline ??
    `${identity.primary} — ${capper.topSport} handicapper on SCL. ${capper.winPct.toFixed(1)}% win rate, ${formatUnits(capper.units)} (${formatRoi(capper.roi)} ROI).`;

  const title =
    handleLabel && identity.secondary
      ? `${identity.primary} (${handleLabel})`
      : identity.primary;

  const base = appUrl();
  const bare = capper.handle.replace(/^@+/, "");
  const pageUrl = `${base}/cappers/${bare}`;
  const ogImage = `${base}/api/og/capper/${bare}`;

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      title,
      description,
      url: pageUrl,
      type: "profile",
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function CapperProfilePage({ params }: ProfileParams) {
  const { handle } = await params;
  const data = await getPublicCapperByHandle(handle);
  if (!data) notFound();

  const { capper, plays, playsError, avgClv } = data;
  const identity = identityDisplayLinesFromCapper(capper);

  return (
    <div className="overflow-x-hidden pb-6 sm:pb-8">
      {/* Header owns its own full-bleed cover + constrained identity column. */}
      <CapperProfileHeader capper={capper} />

      <div className="mx-auto mt-5 max-w-5xl px-4 sm:px-6">
        <PerformanceSummary capper={capper} avgClv={avgClv} />

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section id="recent-picks" className="scroll-mt-20">
            <SectionHeader
              icon={ListChecks}
              title="Recent Plays"
              subtitle="Latest tracked plays, newest first"
            />
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
                description={`${identity.primary} hasn't posted any graded plays yet.`}
              />
            )}
          </section>

          {capper.storefront ? (
            <aside className="border-border border-t pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
              <CapperStorefront
                className="mt-0"
                storefront={capper.storefront}
                capperName={identity.primary}
              />
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}
