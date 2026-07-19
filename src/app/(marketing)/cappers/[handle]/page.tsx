import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { identityDisplayLinesFromCapper } from "@/lib/identity";
import { buildCapperProfileMetadata } from "@/lib/capper-profile-seo";
import { getPublicCapperByHandle } from "@/lib/queries/capper";
import { getLivePackagesForCapper } from "@/lib/queries/store";
import { CapperProfileHeader } from "@/components/scl/capper-profile-header";
import { CapperProfileMeta } from "@/components/scl/capper-profile-meta";
import { CompareTray } from "@/components/scl/compare-tray";
import { EvidenceBrief } from "@/components/scl/evidence-brief";
import { ResponsiveCapperStorefront } from "@/components/scl/responsive-capper-storefront";

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

  const { capper, plays, playsError, avgClv, clvTracker } = data;
  const identity = identityDisplayLinesFromCapper(capper);
  const packages = await getLivePackagesForCapper(capper.id);

  return (
    <div className="overflow-x-hidden pb-6 sm:pb-8" data-visual-mode="proof">
      <CapperProfileHeader capper={capper} />

      <div className="mx-auto mt-3 max-w-[1400px] px-4 sm:mt-5 sm:px-6 lg:px-8">
        <EvidenceBrief
          capper={capper}
          plays={plays}
          playsError={playsError}
          avgClv={avgClv}
          clvTracker={clvTracker}
          emptyName={identity.primary}
          desktopStorefront={
            <ResponsiveCapperStorefront
              viewport="desktop"
              className="mt-0"
              storefront={capper.storefront}
              capperName={identity.primary}
              packages={packages}
            />
          }
        />
        <CapperProfileMeta capper={capper} />
        {/* Mobile stack unchanged: EvidenceBrief → Meta → Marketplace */}
        <div className="border-border mt-6 border-t pt-5 lg:hidden">
          <ResponsiveCapperStorefront
            viewport="mobile"
            className="mt-0"
            storefront={capper.storefront}
            capperName={identity.primary}
            packages={packages}
          />
        </div>
      </div>
      <CompareTray />
      <div className="h-16" aria-hidden />
    </div>
  );
}
