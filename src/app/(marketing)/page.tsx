import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Activity, ArrowRight, ShieldCheck } from "lucide-react";
import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { CompetitionHero } from "@/components/scl/competition-hero";
import { FeaturedProofReceipt } from "@/components/scl/featured-proof-receipt";
import { LiveBoardShell } from "@/components/scl/live-board-shell";
import { HomeVerificationRail } from "@/components/scl/home-verification-rail";
import { PlatformClvSummary } from "@/components/scl/platform-clv-summary";
import { SectionHeader } from "@/components/scl/section";
import { TopCappersLive } from "@/components/scl/top-cappers-live";
import { WhatChangedToday } from "@/components/scl/what-changed-today";
import { LiveActivityTicker } from "@/components/scl/live-activity-ticker";

import { appUrl } from "@/lib/app-url";
import { slimBoardCapper } from "@/lib/board-capper";
import {
  BOTTOM_BAND_BODY,
  BOTTOM_BAND_HEADLINE,
  TRACK_YOUR_RECORD_CTA,
} from "@/lib/cold-start-copy";
import { sortLeaderboard } from "@/lib/leaderboard";
import { platformReportSubtitle } from "@/lib/league-action";
import {
  getFeaturedGradedPlay,
  getTodaysGradedMoves,
} from "@/lib/queries/home-live";
import { getLiveActivityTicker } from "@/lib/queries/live-activity-ticker";
import { getLeaderboardResult } from "@/lib/queries/leaderboard";
import { getLeagueActionReport } from "@/lib/queries/league-action";
import { getPlatformClvSummary } from "@/lib/queries/platform-clv";

export const revalidate = 60;

const HOME_TITLE = "SCL — Sports Capper Leaderboard";
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
          alt: "SCL Sports Capper Leaderboard",
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
  const updatedAt = new Date();
  const { cappers, failed } = await getLeaderboardResult({
    verifiedOnly: true,
  });
  const snapshot = sortLeaderboard(cappers, "units")
    .slice(0, 5)
    .map(slimBoardCapper);

  return (
    <CompetitionHero
      board={
        <LiveBoardShell
          cappers={snapshot}
          leaderboardFailed={failed}
          updatedAt={updatedAt}
        />
      }
    />
  );
}

async function HomeLiveStrip() {
  const [liveTicker, todaysMoves] = await Promise.all([
    getLiveActivityTicker(),
    getTodaysGradedMoves(),
  ]);

  if (liveTicker.items.length > 0) {
    return (
      <LiveActivityTicker items={liveTicker.items} failed={liveTicker.failed} />
    );
  }

  return (
    <div className="border-border border-b bg-[color:var(--scl-ink-900)]">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <WhatChangedToday
          moves={todaysMoves.moves}
          failed={todaysMoves.failed}
        />
      </div>
    </div>
  );
}

async function HomeTopBoard() {
  const [leaderboard, featured] = await Promise.all([
    getLeaderboardResult({ verifiedOnly: true }),
    getFeaturedGradedPlay(),
  ]);
  const topCappers = sortLeaderboard(leaderboard.cappers, "verified")
    .slice(0, 10)
    .map(slimBoardCapper);

  return (
    <div className="scl-board min-w-0">
      <div className="relative grid min-w-0 gap-0 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,0.85fr)] lg:items-start">
        <div className="scl-board-rule relative min-w-0 border-b px-3 py-4 sm:px-5 sm:py-6 lg:border-r lg:border-b-0 lg:px-5 lg:pr-6 lg:pl-5">
          <div className="scl-live-rail hidden lg:block" aria-hidden />
          <TopCappersLive
            cappers={topCappers}
            failed={leaderboard.failed}
            activeWindow="all"
          />
        </div>
        <div className="min-w-0 space-y-5 px-3 py-4 sm:space-y-7 sm:px-5 sm:py-6 lg:pl-6">
          <FeaturedProofReceipt play={featured.play} failed={featured.failed} />
          <HomeVerificationRail />
        </div>
      </div>
    </div>
  );
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
        subtitle="Pricing Vs Close On Board-Verified Picks With A Stored Closing Line"
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
        <Suspense fallback={<SectionSkeleton className="h-80 w-full" />}>
          <HomeTopBoard />
        </Suspense>

        <div className="mt-8 space-y-8 sm:mt-14 sm:space-y-14">
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
            <Button
              render={<Link href="/signup" />}
              nativeButton={false}
              variant="brand"
              size="lg"
              className="min-h-10 w-full shrink-0 gap-2 sm:w-auto"
            >
              {TRACK_YOUR_RECORD_CTA}{" "}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </section>
        </div>
      </div>
    </>
  );
}
