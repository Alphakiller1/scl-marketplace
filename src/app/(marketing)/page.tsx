import Link from "next/link";
import { ArrowRight, Flame, ShieldCheck, Trophy, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/scl/section";
import { CompetitionHero } from "@/components/scl/competition-hero";
import { RankingRail } from "@/components/scl/ranking-rail";
import { PickCard } from "@/components/scl/pick-card";
import { EmptyState } from "@/components/scl/states";
import { sortLeaderboard } from "@/lib/leaderboard";
import { getLeaderboardResult } from "@/lib/queries/leaderboard";
import { getPublicRecentPicksResult } from "@/lib/queries/plays";

export const revalidate = 60;

export default async function Home() {
  const { cappers, failed: leaderboardFailed } = await getLeaderboardResult({
    verifiedOnly: true,
  });
  const { picks: recentPicks, failed: picksFailed } =
    await getPublicRecentPicksResult(cappers, 4);
  const topRoi = sortLeaderboard(cappers, "roi").slice(0, 3);

  return (
    <>
      <CompetitionHero />

      <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:space-y-14 sm:px-6 sm:py-12">
        <section className="space-y-4">
          <SectionHeader
            icon={Trophy}
            title="Performance Leaderboard"
            subtitle="Verified records ranked by net units"
            href="/leaderboard"
          />
          {cappers.length ? (
            <RankingRail cappers={cappers.slice(0, 6)} metric="units" />
          ) : (
            <EmptyState
              icon={Trophy}
              title={
                leaderboardFailed
                  ? "Couldn't Load The Leaderboard"
                  : "No Ranked Cappers Found"
              }
              description={
                leaderboardFailed
                  ? "Performance data is temporarily unavailable. Please try again shortly."
                  : "Verified cappers will rank here after their first graded plays."
              }
            />
          )}
        </section>

        <section className="space-y-4">
          <SectionHeader
            icon={Zap}
            title="Latest Tracked Picks"
            subtitle="Recent submissions from ranked cappers"
            href="/picks"
          />
          {recentPicks.length ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {recentPicks.map((pick) => (
                <PickCard key={pick.id} pick={pick} compact />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Zap}
              title={
                picksFailed
                  ? "Couldn't Load Public Picks"
                  : "No Public Picks Yet"
              }
              description={
                picksFailed
                  ? "Recent tracked submissions are temporarily unavailable. Please try again shortly."
                  : "Tracked submissions from active cappers will appear here."
              }
            />
          )}
        </section>

        <section className="space-y-4">
          <SectionHeader
            icon={Flame}
            title="ROI Leaders"
            subtitle="Best return across each capper's tracked sample"
            href="/cappers"
          />
          {topRoi.length ? (
            <RankingRail cappers={topRoi} metric="roi" />
          ) : (
            <EmptyState
              icon={Flame}
              title="No ROI Leaders Yet"
              description="ROI rankings appear after cappers build a graded sample."
            />
          )}
        </section>

        <section className="border-border flex flex-col items-stretch gap-5 border-y py-8 sm:flex-row sm:items-center sm:justify-between sm:py-10">
          <div className="max-w-2xl">
            <ShieldCheck className="text-brand size-8" />
            <h2 className="mt-4 text-2xl font-bold text-balance sm:text-3xl">
              Build A Record People Can Inspect
            </h2>
            <p className="text-muted-foreground mt-2">
              Log plays, accumulate a transparent performance history, and
              compete for public rank.
            </p>
          </div>
          <Button
            render={<Link href="/signup" />}
            nativeButton={false}
            size="lg"
            className="min-h-11 w-full shrink-0 gap-2 sm:min-h-9 sm:w-auto"
          >
            Become A Capper <ArrowRight className="size-4" aria-hidden />
          </Button>
        </section>
      </div>
    </>
  );
}
