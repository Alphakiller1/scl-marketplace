import type { Metadata } from "next";
import { Suspense } from "react";
import { Activity, ShieldCheck } from "lucide-react";
import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

import { CompetitionHero } from "@/components/scl/competition-hero";
import { PlatformClvSummary } from "@/components/scl/platform-clv-summary";
import { SectionHeader } from "@/components/scl/section";
import {
  TrackRecordCta,
  TrackRecordCtaFallback,
} from "@/components/scl/track-record-cta";
import { LiveActivityTicker } from "@/components/scl/live-activity-ticker";
import { HonorsSpotlight } from "@/components/scl/honors-spotlight";

import { appUrl } from "@/lib/app-url";
import { SCL_BRAND_NAME, SCL_TITLE } from "@/lib/brand";
import { BOTTOM_BAND_BODY, BOTTOM_BAND_HEADLINE } from "@/lib/cold-start-copy";
import { platformReportSubtitle } from "@/lib/league-action";
import { getLiveActivityTicker } from "@/lib/queries/live-activity-ticker";
import { getLeagueActionReport } from "@/lib/queries/league-action";
import { getPlatformClvSummary } from "@/lib/queries/platform-clv";
import { getCurrentHonors } from "@/lib/queries/honors";

export const revalidate = 60;

const HOME_TITLE = SCL_TITLE;
const HOME_DESCRIPTION =
  "Inspect verified sports capper records, public picks, timestamps, and leaderboard history. Transparent records for bettors and founding cappers — SCL does not process payments.";

/** Heavy client island — load after hero paints. */
const LeagueActionReport = dynamic(
  () =>
    import("@/components/scl/league-action-report").then((m) => ({
      default: m.LeagueActionReport,
    })),
  {
    loading: () => (
      <Skeleton className="h-72 w-full rounded-[var(--scl-radius-card)]" />
    ),
  },
);

export async function generateMetadata(): Promise<Metadata> {
  const base = appUrl();
  // Static OG — avoid a second full leaderboard scan on every home request.
  const ogImage = `${base}/api/og/capper/demo_capper`;

  return {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    alternates: { canonical: base },
    openGraph: {
      title: HOME_TITLE,
      description: HOME_DESCRIPTION,
      url: base,
      type: "website",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `SCL ${SCL_BRAND_NAME}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: HOME_TITLE,
      description: HOME_DESCRIPTION,
      images: [ogImage],
    },
  };
}

function SectionSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton
      className={className ?? "h-48 w-full rounded-[var(--scl-radius-card)]"}
    />
  );
}

async function HomeHero() {
  const awards = await getCurrentHonors();

  return (
    <CompetitionHero
      board={
        <div className="dark scl-elevated border-border rounded-[var(--scl-radius-card)] border bg-[color:var(--scl-ink-800)] p-4 sm:p-5">
          <HonorsSpotlight awards={awards.slice(0, 3)} />
        </div>
      }
    />
  );
}

async function HomeLiveStrip() {
  const liveTicker = await getLiveActivityTicker();
  return <LiveActivityTicker items={liveTicker.items} />;
}

async function HomePlatformReport() {
  const { leagues, categories, trackedPicks, windowDays, failed } =
    await getLeagueActionReport();

  return (
    <section className="space-y-4 sm:space-y-5">
      <SectionHeader
        icon={Activity}
        title="Platform Activity Report"
        subtitle={platformReportSubtitle(windowDays)}
        href="/picks"
      />
      <LeagueActionReport
        leagues={leagues}
        categories={categories}
        trackedPicks={trackedPicks}
        windowDays={windowDays}
        failed={failed}
      />
    </section>
  );
}

async function HomePlatformClv() {
  const { summary, failed } = await getPlatformClvSummary();

  return (
    <section className="space-y-4 sm:space-y-5">
      <SectionHeader
        icon={Activity}
        title="Platform CLV"
        subtitle="Pricing Vs Close On Odds-Verified Picks With A Stored Closing Line"
        href="/leaderboard?sort=clv"
      />
      <PlatformClvSummary summary={summary} failed={failed} />
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Suspense
        fallback={
          <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
            <SectionSkeleton className="h-72 w-full rounded-[var(--scl-radius-card)]" />
          </div>
        }
      >
        <HomeHero />
      </Suspense>

      <Suspense
        fallback={<SectionSkeleton className="h-12 w-full rounded-none" />}
      >
        <HomeLiveStrip />
      </Suspense>

      <div className="mx-auto max-w-[1400px] min-w-0 px-4 pt-5 pb-8 sm:px-6 sm:pt-8 sm:pb-12 lg:px-8">
        <div className="space-y-8 sm:space-y-14">
          <Suspense fallback={<SectionSkeleton className="h-72 w-full" />}>
            <HomePlatformReport />
          </Suspense>

          <Suspense fallback={<SectionSkeleton className="h-56 w-full" />}>
            <HomePlatformClv />
          </Suspense>

          <section className="border-border flex flex-col items-stretch gap-5 border-y py-8 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:py-12">
            <div className="max-w-2xl">
              <ShieldCheck className="size-8 text-[color:var(--scl-muted-data)]" />
              <h2 className="scl-display mt-3 text-2xl font-bold tracking-[0.04em] text-balance sm:mt-4 sm:text-3xl">
                {BOTTOM_BAND_HEADLINE}
              </h2>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed sm:mt-3 sm:text-base">
                {BOTTOM_BAND_BODY}
              </p>
            </div>
            <Suspense fallback={<TrackRecordCtaFallback />}>
              <TrackRecordCta />
            </Suspense>
          </section>
        </div>
      </div>
    </>
  );
}
