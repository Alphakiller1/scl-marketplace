import Link from "next/link";
import { Activity, ArrowRight, Flame, ShieldCheck, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/scl/section";
import { CompetitionHero } from "@/components/scl/competition-hero";
import { Leaderboard } from "@/components/scl/leaderboard";
import { CapperCard } from "@/components/scl/capper-card";
import { EmptyState } from "@/components/scl/states";
import { SportTag } from "@/components/scl/badges";
import { LeagueMark } from "@/components/scl/league-mark";
import { sortLeaderboard } from "@/lib/leaderboard";
import { getLeaderboardResult } from "@/lib/queries/leaderboard";
import { getLeagueActionReport } from "@/lib/queries/league-action";

export const revalidate = 60;

export default async function Home() {
  const { cappers, failed: leaderboardFailed } = await getLeaderboardResult({
    verifiedOnly: true,
  });
  const {
    leagues,
    windowDays,
    failed: leagueActionFailed,
  } = await getLeagueActionReport();
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
          <Leaderboard
            cappers={cappers}
            failed={leaderboardFailed}
            limit={6}
            compactMobile
            emptyDescription="Verified cappers will rank here after their first graded plays."
          />
        </section>

        <section className="space-y-4">
          <SectionHeader
            icon={Activity}
            title="League Action Report"
            subtitle={`Most active leagues by tracked pick volume over the last ${windowDays} days`}
            href="/picks"
          />
          {leagues.length ? (
            <div className="border-border bg-card overflow-hidden rounded-xl border">
              <div className="divide-border divide-y">
                {leagues.map((league, index) => (
                  <div
                    key={league.key}
                    className="flex min-h-20 flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <LeagueMark leagueKey={league.league} size="lg" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="nums text-muted-foreground text-xs font-semibold tabular-nums">
                            #{index + 1}
                          </span>
                          <h3 className="truncate font-bold">
                            {league.league}
                          </h3>
                          <SportTag sport={league.sport} withMark={false} />
                        </div>
                        <p className="text-muted-foreground mt-1 text-sm">
                          Recent verified-board activity from public cappers.
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:min-w-52">
                      <LeagueActionMetric
                        label="Picks"
                        value={league.pickCount}
                      />
                      <LeagueActionMetric
                        label="Cappers"
                        value={league.activeCappers}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Activity}
              title={
                leagueActionFailed
                  ? "Couldn't Load League Action"
                  : "No League Action Yet"
              }
              description={
                leagueActionFailed
                  ? "Recent league activity is temporarily unavailable. Please try again shortly."
                  : "Tracked pick volume will appear here as cappers submit board-verified plays."
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
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {topRoi.map((capper, index) => (
                <CapperCard
                  key={capper.id}
                  capper={capper}
                  rank={index + 1}
                  compact
                />
              ))}
            </div>
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

function LeagueActionMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="bg-surface-2 flex min-h-11 flex-col justify-center rounded-lg px-3 py-2 text-right">
      <span className="nums text-base font-bold tabular-nums">
        {value.toLocaleString()}
      </span>
      <span className="text-muted-foreground text-[0.7rem] font-semibold uppercase">
        {label}
      </span>
    </div>
  );
}
