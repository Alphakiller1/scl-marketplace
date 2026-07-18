import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowRight, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

import { CompetitionHero } from "@/components/scl/competition-hero";
import { FeaturedProofReceipt } from "@/components/scl/featured-proof-receipt";
import { HomeLiveBoard } from "@/components/scl/home-live-board";
import { LeaderboardSnapshot } from "@/components/scl/leaderboard-snapshot";
import { LeagueActionReport } from "@/components/scl/league-action-report";
import { SectionHeader } from "@/components/scl/section";
import { TopCappersLive } from "@/components/scl/top-cappers-live";
import { VerificationLegend } from "@/components/scl/verification-legend";
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

  const snapshot = sortLeaderboard(cappers, "units").slice(0, 5);
  const topCappers = sortLeaderboard(cappers, "units").slice(0, 5);

  return (
    <>
      <CompetitionHero />

      <YesterdayWinsTicker
        wins={gradedWinsTicker.wins}
        label={gradedWinsTicker.label}
      />

      <div className="mx-auto max-w-6xl space-y-10 overflow-x-hidden px-4 py-10 sm:space-y-14 sm:px-6 sm:py-12">
        <HomeLiveBoard>
          <LeaderboardSnapshot
            cappers={snapshot}
            failed={leaderboardFailed}
            updatedAt={updatedAt}
            limit={5}
          />
          <WhatChangedToday moves={moves} failed={movesFailed} />
          <TopCappersLive cappers={topCappers} failed={leaderboardFailed} />
          <FeaturedProofReceipt play={featuredPlay} failed={featuredFailed} />
        </HomeLiveBoard>

        <section
          id="how-verification-works"
          className="border-border scroll-mt-20 space-y-3 rounded-xl border p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="bg-surface-2 text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                <ShieldCheck className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold tracking-wide">
                  How verification works
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Account checks and pick authenticity are separate. Inspect
                  every record before you follow anyone off-platform.
                </p>
              </div>
            </div>
          </div>
          <VerificationLegend />
        </section>

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
    </>
  );
}
