import type { Metadata } from "next";
import Link from "next/link";

import { Activity, ArrowRight, Flame, ShieldCheck, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";

import { SectionHeader } from "@/components/scl/section";

import { CompetitionHero } from "@/components/scl/competition-hero";
import { Leaderboard } from "@/components/scl/leaderboard";

import { EmptyState } from "@/components/scl/states";

import { YesterdayWinsTicker } from "@/components/scl/yesterday-wins-ticker";

import { RoiLeadersPanel } from "@/components/scl/roi-leaders-panel";
import { LeagueActionReport } from "@/components/scl/league-action-report";

import { appUrl } from "@/lib/app-url";
import { sortLeaderboard } from "@/lib/leaderboard";

import { getLeaderboardResult } from "@/lib/queries/leaderboard";

import { getLeagueActionReport } from "@/lib/queries/league-action";

import { getYesterdaysGradedWins } from "@/lib/queries/yesterday-wins";

import { VerificationLegend } from "@/components/scl/verification-legend";
import {
  BOTTOM_BAND_BODY,
  BOTTOM_BAND_HEADLINE,
  ROI_LEADERS_EMPTY_BODY,
  ROI_LEADERS_EMPTY_LABEL,
  ROI_LEADERS_EMPTY_TITLE,
  TRACK_YOUR_RECORD_CTA,
} from "@/lib/cold-start-copy";

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
  const { cappers, failed: leaderboardFailed } = await getLeaderboardResult({
    verifiedOnly: true,
  });

  const {
    leagues,

    categories,

    windowDays,

    failed: leagueActionFailed,
  } = await getLeagueActionReport();

  const gradedWinsTicker = await getYesterdaysGradedWins();

  const topRoi = sortLeaderboard(cappers, "roi").slice(0, 3);

  return (
    <>
      <CompetitionHero />

      <YesterdayWinsTicker
        wins={gradedWinsTicker.wins}
        label={gradedWinsTicker.label}
      />

      <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:space-y-14 sm:px-6 sm:py-12">
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
                <h2 className="text-sm font-bold tracking-wide uppercase">
                  How Verification Works
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
            icon={Trophy}
            title="SCL Primary Leaderboard"
            subtitle="Transparent records ranked when sample thresholds are met"
            href="/leaderboard"
          />

          <Leaderboard
            cappers={cappers}
            failed={leaderboardFailed}
            limit={6}
            compactMobile
            emptyDescription="The founding roster is forming. Verified cappers will appear here after they clear SCL’s ranking sample — early records stay inspectable under Building A Record."
          />
        </section>

        <section className="space-y-4">
          <SectionHeader
            icon={Activity}
            title="League Action Report"
            subtitle={`Verified board activity from public cappers — last ${windowDays} days`}
            href="/picks"
          />

          <LeagueActionReport
            leagues={leagues}
            categories={categories}
            windowDays={windowDays}
            failed={leagueActionFailed}
          />
        </section>

        <section className="space-y-4">
          <SectionHeader
            icon={Flame}
            title="ROI Leaders"
            subtitle="Return across each capper’s graded sample — after sample thresholds"
            href="/cappers"
          />

          {topRoi.length ? (
            <RoiLeadersPanel cappers={topRoi} />
          ) : (
            <EmptyState
              icon={Flame}
              title={ROI_LEADERS_EMPTY_TITLE}
              description={ROI_LEADERS_EMPTY_BODY}
              action={
                <div className="flex w-full flex-col items-center gap-3">
                  <p className="scl-data text-muted-foreground text-[0.65rem] font-semibold tracking-[0.12em] uppercase">
                    {ROI_LEADERS_EMPTY_LABEL}
                  </p>
                  <Button
                    render={<Link href="/leaderboard#building-a-record" />}
                    nativeButton={false}
                    variant="outline"
                    className="min-h-11 gap-2"
                  >
                    View Building Records
                    <ArrowRight className="size-4" aria-hidden />
                  </Button>
                </div>
              }
            />
          )}
        </section>

        <section className="border-border flex flex-col items-stretch gap-5 border-y py-8 sm:flex-row sm:items-center sm:justify-between sm:py-10">
          <div className="max-w-2xl">
            <ShieldCheck className="size-8 text-[color:var(--scl-muted-data)]" />

            <h2 className="scl-display mt-4 text-2xl font-bold tracking-[0.04em] text-balance uppercase sm:text-3xl">
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
