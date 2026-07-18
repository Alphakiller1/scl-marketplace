import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowRight, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

import { CompetitionHero } from "@/components/scl/competition-hero";
import { FeaturedProofReceipt } from "@/components/scl/featured-proof-receipt";
import { HomeEvidenceField } from "@/components/scl/home-live-board";
import { HomeVerificationRail } from "@/components/scl/home-verification-rail";
import { LeaderboardSnapshot } from "@/components/scl/leaderboard-snapshot";
import { LeagueActionReport } from "@/components/scl/league-action-report";
import { PlatformClvSummary } from "@/components/scl/platform-clv-summary";
import { SectionHeader } from "@/components/scl/section";
import { TopCappersLive } from "@/components/scl/top-cappers-live";
import { WhatChangedToday } from "@/components/scl/what-changed-today";
import { YesterdayWinsTicker } from "@/components/scl/yesterday-wins-ticker";

import { appUrl } from "@/lib/app-url";
import {
  BOTTOM_BAND_BODY,
  BOTTOM_BAND_HEADLINE,
  TRACK_YOUR_RECORD_CTA,
} from "@/lib/cold-start-copy";
import { sortLeaderboard } from "@/lib/leaderboard";
import {
  getFeaturedGradedPlay,
  getTodaysGradedMoves,
} from "@/lib/queries/home-live";
import { getLeaderboardResult } from "@/lib/queries/leaderboard";
import { getLeagueActionReport } from "@/lib/queries/league-action";
import { getPlatformClvSummary } from "@/lib/queries/platform-clv";
import { getYesterdaysGradedWins } from "@/lib/queries/yesterday-wins";

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

  const gradedWinsTicker = await getYesterdaysGradedWins();
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
      <CompetitionHero />

      <YesterdayWinsTicker
        wins={gradedWinsTicker.wins}
        label={gradedWinsTicker.label}
      />

      <div className="mx-auto max-w-6xl overflow-x-hidden px-4 py-8 sm:px-6 sm:py-10">
        <HomeEvidenceField
          leaderboard={
            <LeaderboardSnapshot
              cappers={snapshot}
              failed={leaderboardFailed}
              updatedAt={updatedAt}
              limit={5}
            />
          }
          featuredProof={
            <FeaturedProofReceipt play={featuredPlay} failed={featuredFailed} />
          }
          whatChanged={<WhatChangedToday moves={moves} failed={movesFailed} />}
          topCappers={
            <TopCappersLive cappers={topCappers} failed={leaderboardFailed} />
          }
          verificationContext={<HomeVerificationRail />}
        />

        <div className="mt-10 space-y-10 sm:mt-14 sm:space-y-14">
          <section className="space-y-4">
            <SectionHeader
              icon={Activity}
              title="Platform activity report"
              subtitle={`Most successful bet types from public listed cappers — last ${windowDays} days`}
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
