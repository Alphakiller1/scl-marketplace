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
import { StatValue } from "@/components/scl/stat-value";
import { sortLeaderboard } from "@/lib/leaderboard";
import { getLeaderboardResult } from "@/lib/queries/leaderboard";
import { getLeagueActionReport } from "@/lib/queries/league-action";

export const revalidate = 60;

const PINK_CTA =
  "border-[color:var(--scl-pink)] bg-[color:var(--scl-pink)] text-[color:var(--scl-pink-ink)] hover:bg-[color:var(--scl-pink-deep)] hover:text-[color:var(--scl-pink-ink)]";

export default async function Home() {
  const { cappers, failed: leaderboardFailed } = await getLeaderboardResult({
    verifiedOnly: true,
  });
  const {
    leagues,
    windowDays,
    failed: leagueActionFailed,
    includesUnranked,
  } = await getLeagueActionReport();
  const topRoi = sortLeaderboard(cappers, "roi").slice(0, 3);
  const roiGridClass =
    topRoi.length <= 1
      ? "grid gap-2"
      : topRoi.length === 2
        ? "grid gap-2 sm:grid-cols-2"
        : "grid gap-2 sm:grid-cols-2 lg:grid-cols-3";

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
          {includesUnranked ? (
            <p className="text-muted-foreground -mt-2 text-xs">
              Includes activity from unranked cappers
            </p>
          ) : null}
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
                          <StatValue
                            tone="label"
                            className="text-xs font-semibold"
                          >
                            #{index + 1}
                          </StatValue>
                          <h3 className="scl-display truncate font-bold tracking-[0.04em] uppercase">
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
            <div className={roiGridClass}>
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
            <ShieldCheck className="size-8 text-[color:var(--scl-muted-data)]" />
            <h2 className="scl-display mt-4 text-2xl font-bold tracking-[0.04em] text-balance uppercase sm:text-3xl">
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
            className={`min-h-11 w-full shrink-0 gap-2 sm:w-auto ${PINK_CTA}`}
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
      <StatValue tone="text" className="text-base font-bold">
        {value.toLocaleString()}
      </StatValue>
      <span className="text-muted-foreground text-[0.7rem] font-semibold uppercase">
        {label}
      </span>
    </div>
  );
}
