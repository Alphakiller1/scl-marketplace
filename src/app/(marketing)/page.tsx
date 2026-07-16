import type { Metadata } from "next";
import Link from "next/link";

import { Activity, ArrowRight, Flame, ShieldCheck, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";

import { SectionHeader } from "@/components/scl/section";

import { CompetitionHero } from "@/components/scl/competition-hero";
import { FoundingCapperBanner } from "@/components/scl/founding-capper-banner";

import { Leaderboard } from "@/components/scl/leaderboard";

import { EmptyState } from "@/components/scl/states";

import { SportTag } from "@/components/scl/badges";

import { LeagueMark } from "@/components/scl/league-mark";

import { StatValue } from "@/components/scl/stat-value";

import { YesterdayWinsTicker } from "@/components/scl/yesterday-wins-ticker";

import { RoiLeadersPanel } from "@/components/scl/roi-leaders-panel";

import { sortLeaderboard } from "@/lib/leaderboard";

import { getLeaderboardResult } from "@/lib/queries/leaderboard";

import { getLeagueActionReport } from "@/lib/queries/league-action";

import { getYesterdaysGradedWins } from "@/lib/queries/yesterday-wins";

import { LEAGUE_ACTION_CATEGORY_EMPTY } from "@/lib/league-action";
import { VerificationLegend } from "@/components/scl/verification-legend";
import {
  ROI_LEADERS_EMPTY_BODY,
  ROI_LEADERS_EMPTY_LABEL,
  ROI_LEADERS_EMPTY_TITLE,
} from "@/lib/cold-start-copy";

export const revalidate = 60;

export const metadata: Metadata = {
  title: { absolute: "SCL — Sports Capper Leaderboard" },
  description:
    "Inspect verified sports capper records, public picks, timestamps, and leaderboard history. Transparent records for bettors and founding cappers — SCL does not process payments.",
};

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

  const yesterdayWins = await getYesterdaysGradedWins();

  const topRoi = sortLeaderboard(cappers, "roi").slice(0, 3);

  return (
    <>
      <CompetitionHero />

      <YesterdayWinsTicker wins={yesterdayWins} />

      <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:space-y-14 sm:px-6 sm:py-12">
        <FoundingCapperBanner />
        <section className="space-y-4">
          <SectionHeader
            icon={Trophy}
            title="Performance Leaderboard"
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
                  : "Tracked pick volume will appear here as founding cappers submit board-verified plays."
              }
            />
          )}

          <div className="border-border bg-card overflow-hidden rounded-xl border">
            <div className="divide-border grid gap-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {categories.map((cat) => (
                <div
                  key={cat.key}
                  className="border-border min-h-24 border-b p-3 last:border-b-0 sm:border-r sm:last:border-r-0"
                >
                  <p className="text-foreground text-sm font-semibold">
                    {cat.label}
                  </p>

                  {cat.picks > 0 ? (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <LeagueActionMetric label="Picks" value={cat.picks} />

                      <LeagueActionMetric label="Cappers" value={cat.cappers} />
                    </div>
                  ) : (
                    <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                      {LEAGUE_ACTION_CATEGORY_EMPTY[cat.key]}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <p className="text-muted-foreground border-border border-t px-3 py-2 text-xs">
              Counts include ranked and building-a-record cappers. Test accounts
              are excluded.
            </p>
          </div>
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

        <section className="border-border flex flex-col items-stretch gap-5 border-y py-8 sm:flex-row sm:items-center sm:justify-between sm:py-10">
          <div className="max-w-2xl">
            <ShieldCheck className="size-8 text-[color:var(--scl-muted-data)]" />

            <h2 className="scl-display mt-4 text-2xl font-bold tracking-[0.04em] text-balance uppercase sm:text-3xl">
              Build A Record People Can Inspect
            </h2>

            <p className="text-muted-foreground mt-2">
              Join the founding roster and give your audience a public,
              timestamped record before sending them to your Whop, Winible,
              DubClub, or community checkout. SCL does not process payments.
            </p>
          </div>

          <Button
            render={<Link href="/signup" />}
            nativeButton={false}
            size="lg"
            className={`min-h-11 w-full shrink-0 gap-2 sm:w-auto ${PINK_CTA}`}
          >
            Apply As A Founding Capper{" "}
            <ArrowRight className="size-4" aria-hidden />
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
