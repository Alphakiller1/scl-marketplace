import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowRight, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

import { CompetitionHero } from "@/components/scl/competition-hero";
import { FeaturedProofReceipt } from "@/components/scl/featured-proof-receipt";
import { HeroBoardCollage } from "@/components/scl/hero-board-collage";
import { HomeVerificationRail } from "@/components/scl/home-verification-rail";
import { LeagueActionReport } from "@/components/scl/league-action-report";
import { PlatformClvSummary } from "@/components/scl/platform-clv-summary";
import { SectionHeader } from "@/components/scl/section";
import { TopCappersLive } from "@/components/scl/top-cappers-live";
import { WhatChangedToday } from "@/components/scl/what-changed-today";

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

const PINK_CTA =
  "border-[color:var(--scl-pink)] bg-[color:var(--scl-pink)] text-[color:var(--scl-pink-ink)] hover:bg-[color:var(--scl-pink-deep)] hover:text-[color:var(--scl-pink-ink)]";

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

  const { moves, failed: movesFailed } = await getTodaysGradedMoves();
  const { play: featuredPlay, failed: featuredFailed } =
    await getFeaturedGradedPlay();
  const { summary: platformClv, failed: platformClvFailed } =
    await getPlatformClvSummary();

  // Snapshot = board place by units. Top cappers = inspectability by verified share.
  const snapshot = sortLeaderboard(cappers, "units").slice(0, 5);
  const topCappers = sortLeaderboard(cappers, "verified").slice(0, 5);

  return (
    <>
      <CompetitionHero
        board={
          <HeroBoardCollage
            cappers={snapshot}
            leaderboardFailed={leaderboardFailed}
            updatedAt={updatedAt}
          />
        }
      />

      {/* Mockup: thin What Changed strip under hero */}
      <div className="border-border border-b bg-[color:var(--scl-ink-900)]">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <WhatChangedToday moves={moves} failed={movesFailed} />
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] overflow-x-hidden px-4 pt-6 pb-8 sm:px-6 sm:pt-8 sm:pb-10 lg:px-8">
        {/* Mockup body: Top Cappers table + Featured Proof */}
        <div className="border-border grid gap-0 border-y lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)] lg:items-start">
          <div className="scl-scanline border-border relative min-w-0 border-b px-0 py-5 lg:border-r lg:border-b-0 lg:pr-6 lg:pl-5">
            <div
              className="pointer-events-none absolute inset-y-0 left-0 hidden w-1 bg-[color:var(--scl-blue)] lg:block"
              aria-hidden
            />
            <TopCappersLive
              cappers={topCappers}
              failed={leaderboardFailed}
              activeWindow="30d"
            />
          </div>
          <div className="min-w-0 space-y-6 px-0 py-5 lg:pl-6">
            <FeaturedProofReceipt play={featuredPlay} failed={featuredFailed} />
            <HomeVerificationRail />
          </div>
        </div>

        <div className="mt-10 space-y-10 sm:mt-14 sm:space-y-14">
          <section className="space-y-4">
            <SectionHeader
              icon={Activity}
              title="Platform activity report"
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
              subtitle="Pricing vs close on board-verified picks with a stored closing line"
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
              size="lg"
              className={`min-h-11 w-full shrink-0 gap-2 sm:w-auto ${PINK_CTA}`}
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
