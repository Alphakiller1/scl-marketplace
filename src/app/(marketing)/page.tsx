import Link from "next/link";
import { ArrowRight, Flame, ShieldCheck, Trophy, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/scl/section";
import { CompetitionHero } from "@/components/scl/competition-hero";
import { Leaderboard } from "@/components/scl/leaderboard";
import { CapperCard } from "@/components/scl/capper-card";
import { PickCard } from "@/components/scl/pick-card";
import { EmptyState } from "@/components/scl/states";
import { sortLeaderboard, summarizeLeaderboard } from "@/lib/leaderboard";
import { getLeaderboardResult } from "@/lib/queries/leaderboard";
import { getPublicRecentPicksResult } from "@/lib/queries/plays";

export const revalidate = 60;

export default async function Home() {
  const { cappers, failed: leaderboardFailed } = await getLeaderboardResult({
    verifiedOnly: true,
  });
  const summary = summarizeLeaderboard(cappers);
  const { picks: recentPicks, failed: picksFailed } =
    await getPublicRecentPicksResult(cappers, 4);
  const topRoi = sortLeaderboard(cappers, "roi").slice(0, 3);

  return (
    <>
      <CompetitionHero summary={summary} />

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-12 sm:px-6">
        <section className="space-y-4">
          <SectionHeader
            icon={Trophy}
            title="Performance leaderboard"
            subtitle="Verified records ranked by net units"
            href="/leaderboard"
          />
          <Leaderboard
            cappers={cappers}
            failed={leaderboardFailed}
            limit={6}
            emptyDescription="Verified cappers will rank here after their first graded plays."
          />
        </section>

        <section className="space-y-4">
          <SectionHeader
            icon={Zap}
            title="Latest tracked picks"
            subtitle="Recent submissions from ranked cappers"
            href="/picks"
          />
          {recentPicks.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {recentPicks.map((pick) => (
                <PickCard key={pick.id} pick={pick} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Zap}
              title={
                picksFailed
                  ? "Couldn't load public picks"
                  : "No public picks yet"
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
            title="ROI leaders"
            subtitle="Best return across each capper's tracked sample"
            href="/cappers"
          />
          {topRoi.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topRoi.map((capper, index) => (
                <CapperCard key={capper.id} capper={capper} rank={index + 1} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Flame}
              title="No ROI leaders yet"
              description="ROI rankings appear after cappers build a graded sample."
            />
          )}
        </section>

        <section className="border-border flex flex-col items-start gap-4 border-y py-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <ShieldCheck className="text-brand size-8" />
            <h2 className="mt-4 text-2xl font-bold text-balance sm:text-3xl">
              Build a record people can inspect.
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
            className="shrink-0 gap-2"
          >
            Become a capper <ArrowRight className="size-4" aria-hidden />
          </Button>
        </section>
      </div>
    </>
  );
}
