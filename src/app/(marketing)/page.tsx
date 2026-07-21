import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowRight, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

import { CompetitionHero } from "@/components/scl/competition-hero";
import { FeaturedProofReceipt } from "@/components/scl/featured-proof-receipt";
import { LiveBoardShell } from "@/components/scl/live-board-shell";
import { HomeVerificationRail } from "@/components/scl/home-verification-rail";
import { LeagueActionReport } from "@/components/scl/league-action-report";
import { PlatformClvSummary } from "@/components/scl/platform-clv-summary";
import { SectionHeader } from "@/components/scl/section";
import { TopCappersLive } from "@/components/scl/top-cappers-live";
import { WhatChangedToday } from "@/components/scl/what-changed-today";
import { LiveActivityTicker } from "@/components/scl/live-activity-ticker";

import { appUrl } from "@/lib/app-url";
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

export async function generateMetadata(): Promise<Metadata> {
  const base = appUrl();
  const { cappers } = await getLeaderboardResult({ verifiedOnly: true });
  const featured =
    sortLeaderboard(cappers, "units")[0] ??
    sortLeaderboard(cappers, "roi")[0] ??
    null;
  const ogHandle = featured?.handle.replace(/^@+/, "") || "demo_capper";
  const ogImage = `${base}/api/og/capper/${ogHandle}`;

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
          alt: featured
            ? `${featured.handle} on SCL`
            : "SCL Sports Capper Leaderboard",
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

export default async function Home() {
  const updatedAt = new Date();

  const { cappers, failed: leaderboardFailed } = await getLeaderboardResult({
    verifiedOnly: true,
  });

  const {
    leagues,
    categories,
    trackedPicks,
    windowDays,
    failed: leagueActionFailed,
  } = await getLeagueActionReport();

  const liveTicker = await getLiveActivityTicker();
  const { moves, failed: movesFailed } = await getTodaysGradedMoves();
  const { play: featuredPlay, failed: featuredFailed } =
    await getFeaturedGradedPlay();
  const { summary: platformClv, failed: platformClvFailed } =
    await getPlatformClvSummary();

  // Snapshot = board place by units. Top cappers = inspectability by verified share.
  const snapshot = sortLeaderboard(cappers, "units").slice(0, 5);
  const topCappers = sortLeaderboard(cappers, "verified").slice(0, 10);

  return (
    <>
      <CompetitionHero
        board={
          <LiveBoardShell
            cappers={snapshot}
            leaderboardFailed={leaderboardFailed}
            updatedAt={updatedAt}
          />
        }
      />

      {/* One under-hero strip: live marquee when present, else What Changed. */}
      {liveTicker.items.length > 0 ? (
        <LiveActivityTicker
          items={liveTicker.items}
          failed={liveTicker.failed}
        />
      ) : (
        <div className="border-border border-b bg-[color:var(--scl-ink-900)]">
          <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
            <WhatChangedToday moves={moves} failed={movesFailed} />
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1400px] overflow-x-hidden px-4 pt-6 pb-8 sm:px-6 sm:pt-8 sm:pb-10 lg:px-8">
        {/* Top Cappers + Featured Proof — solid board panes, no scanlines */}
        <div className="scl-board overflow-hidden">
          <div className="relative grid gap-0 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)] lg:items-start">
            <div className="scl-board-rule relative min-w-0 overflow-hidden border-b py-5 lg:border-r lg:border-b-0 lg:pr-6 lg:pl-5">
              <div className="scl-live-rail hidden lg:block" aria-hidden />
              <TopCappersLive
                cappers={topCappers}
                failed={leaderboardFailed}
                activeWindow="all"
              />
            </div>
            <div className="min-w-0 space-y-6 px-4 py-5 sm:px-5 lg:pl-6">
              <FeaturedProofReceipt
                play={featuredPlay}
                failed={featuredFailed}
              />
              <HomeVerificationRail />
            </div>
          </div>
        </div>

        <div className="mt-10 space-y-10 sm:mt-14 sm:space-y-14">
          <section className="space-y-4">
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
              failed={leagueActionFailed}
            />
          </section>

          <section className="space-y-4">
            <SectionHeader
              icon={Activity}
              title="Platform CLV"
              subtitle="Pricing Vs Close On Board-Verified Picks With A Stored Closing Line"
              href="/leaderboard?sort=clv"
            />
            <PlatformClvSummary
              summary={platformClv}
              failed={platformClvFailed}
            />
          </section>

          <section className="border-border flex flex-col items-stretch gap-5 border-y py-8 sm:flex-row sm:items-center sm:justify-between sm:py-10">
            <div className="max-w-2xl">
              <ShieldCheck className="size-8 text-[color:var(--scl-muted-data)]" />
              <h2 className="scl-display mt-4 text-2xl font-bold tracking-[0.04em] text-balance sm:text-3xl">
                {BOTTOM_BAND_HEADLINE}
              </h2>
              <p className="text-muted-foreground mt-2">{BOTTOM_BAND_BODY}</p>
            </div>
            <Button
              render={<Link href="/signup" />}
              nativeButton={false}
              variant="brand"
              size="lg"
              className="min-h-11 w-full shrink-0 gap-2 sm:w-auto"
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
