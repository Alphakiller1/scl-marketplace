import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CapperProfileHeader } from "@/components/scl/capper-profile-header";
import { CapperProfileMeta } from "@/components/scl/capper-profile-meta";
import { CapperStorefront } from "@/components/scl/capper-storefront";
import { EvidenceBrief } from "@/components/scl/evidence-brief";
import { ProfileTopPackages } from "@/components/scl/profile-top-packages";
import { buildCapperProfileMetadata } from "@/lib/capper-profile-seo";
import { identityDisplayLinesFromCapper } from "@/lib/identity";
import type { ProfilePackageInsight } from "@/lib/package-register";
import { getCapperAccolades } from "@/lib/queries/capper-accolades";
import { getPublicCapperByHandle } from "@/lib/queries/capper";
import { getPackagePerformanceEvidence } from "@/lib/queries/package-performance";
import { getLivePackagesForCapper } from "@/lib/queries/store";

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

  const {
    capper,
    plays,
    playsError,
    avgClv,
    clvTracker,
    chartSeries,
    chartSeriesBySport,
    historyNextCursor,
    legacyBySport,
  } = data;
  const [packages, accolades] = await Promise.all([
    getLivePackagesForCapper(capper.id),
    getCapperAccolades(capper.handle, capper.topSport),
  ]);
  const profileCapper = { ...capper, trophies: accolades };
  const identity = identityDisplayLinesFromCapper(profileCapper);
  const packagePerformance = await getPackagePerformanceEvidence(
    packages.map((pkg) => pkg.id),
  );
  const rankedPackages = packages
    .map((pkg) => ({
      pkg,
      evidence: packagePerformance.evidence[pkg.id] ?? null,
    }))
    .sort(
      (a, b) =>
        (b.evidence?.units ?? Number.NEGATIVE_INFINITY) -
          (a.evidence?.units ?? Number.NEGATIVE_INFINITY) ||
        a.pkg.title.localeCompare(b.pkg.title),
    );
  const packageInsights: ProfilePackageInsight[] = rankedPackages.flatMap(
    ({ pkg, evidence }) => {
      const profile = packagePerformance.profiles[pkg.id];
      return profile
        ? [{ id: pkg.id, title: pkg.title, evidence, ...profile }]
        : [];
    },
  );

  return (
    <div className="min-w-0 pb-6 sm:pb-8" data-visual-mode="proof">
      <CapperProfileHeader capper={profileCapper} />

      <div className="mx-auto mt-3 max-w-[1400px] px-4 sm:mt-5 sm:px-6 lg:px-8">
        <ProfileTopPackages
          packages={rankedPackages.slice(0, 3)}
          totalCount={rankedPackages.length}
        />
        <EvidenceBrief
          capper={profileCapper}
          plays={plays}
          playsError={playsError}
          avgClv={avgClv}
          clvTracker={clvTracker}
          chartSeries={chartSeries}
          chartSeriesBySport={chartSeriesBySport}
          packageInsights={packageInsights}
          legacyBySport={legacyBySport}
          historyNextCursor={historyNextCursor}
          emptyName={identity.primary}
        />
        <CapperProfileMeta capper={profileCapper} />
        <div className="border-border mt-8 border-t pt-6 sm:mt-10 sm:pt-8">
          <CapperStorefront
            className="mt-0"
            storefront={capper.storefront}
            capperName={identity.primary}
            packages={packages}
          />
        </div>
      </div>
      <div className="h-16" aria-hidden />
    </div>
  );
}
