import Link from "next/link";
import { ArrowRight, Flame, ShieldCheck, Trophy, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SectionHeader } from "@/components/scl/section";
import {
  LeaderboardRow,
  LeaderboardMobileCard,
} from "@/components/scl/leaderboard-row";
import { CapperCard } from "@/components/scl/capper-card";
import { PickCard } from "@/components/scl/pick-card";
import { VerificationBadge } from "@/components/scl/badges";
import {
  MOCK_CAPPERS,
  MOCK_TODAY_PICKS,
  MOCK_PLATFORM_STATS,
} from "@/lib/mock";

export default function Home() {
  const leaderboard = MOCK_CAPPERS.filter((c) => c.verified).sort(
    (a, b) => b.units - a.units,
  );
  const topRoi = [...MOCK_CAPPERS].sort((a, b) => b.roi - a.roi).slice(0, 3);

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* Hero — value proposition + trust + live platform stats */}
        <section className="border-border relative overflow-hidden border-b">
          <div
            aria-hidden
            className="scl-glow pointer-events-none absolute inset-0 -z-10"
          />
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="border-border bg-surface-2 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
              <VerificationBadge size="xs" />
              The public performance layer for sports cappers
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-6xl">
              Find out who is <span className="text-pos">actually winning</span>
              .
            </h1>
            <p className="text-muted-foreground mt-5 max-w-2xl text-lg text-pretty">
              SCL ranks real handicappers on verified records — win %, ROI, and
              unit profit, all transparent. Discover the hottest cappers, follow
              today&apos;s picks, and track results you can trust.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                render={<Link href="/leaderboard" />}
                size="lg"
                className="gap-2"
              >
                View the leaderboard <ArrowRight className="size-4" />
              </Button>
              <Button
                render={<Link href="/signup" />}
                size="lg"
                variant="outline"
              >
                Get ranked as a capper
              </Button>
            </div>

            <dl className="mt-10 grid max-w-xl grid-cols-3 gap-4">
              {[
                {
                  label: "Bettors",
                  value: `${(MOCK_PLATFORM_STATS.bettors / 1000).toFixed(1)}k+`,
                },
                {
                  label: "Verified cappers",
                  value: MOCK_PLATFORM_STATS.verifiedCappers,
                },
                {
                  label: "Picks graded / wk",
                  value:
                    MOCK_PLATFORM_STATS.picksGradedThisWeek.toLocaleString(),
                },
              ].map((s) => (
                <div key={s.label}>
                  <dd className="nums text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">
                    {s.value}
                  </dd>
                  <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {s.label}
                  </dt>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <div className="mx-auto max-w-6xl space-y-14 px-4 py-14 sm:px-6">
          {/* This week's leaderboard */}
          <section className="space-y-4">
            <SectionHeader
              icon={Trophy}
              title="This week's leaderboard"
              subtitle="Ranked by units won — verified records only"
              href="/leaderboard"
            />
            {/* Desktop table */}
            <div className="hidden md:block">
              <div className="text-muted-foreground grid grid-cols-[2.5rem_1fr_5rem_5rem_5rem_8rem] gap-3 px-3 pb-1 text-[0.7rem] font-medium tracking-wide uppercase">
                <span>#</span>
                <span>Capper</span>
                <span className="text-right">Win %</span>
                <span className="text-right">Units</span>
                <span className="text-right">ROI</span>
                <span className="text-right">Form</span>
              </div>
              <div className="space-y-0.5">
                {leaderboard.map((c) => (
                  <LeaderboardRow key={c.id} capper={c} />
                ))}
              </div>
            </div>
            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {leaderboard.map((c) => (
                <LeaderboardMobileCard key={c.id} capper={c} />
              ))}
            </div>
          </section>

          {/* Today's picks */}
          <section className="space-y-4">
            <SectionHeader
              icon={Zap}
              title="Today's picks"
              subtitle="Live and pending plays from ranked cappers"
              href="/picks"
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {MOCK_TODAY_PICKS.map((p) => (
                <PickCard key={p.id} pick={p} />
              ))}
            </div>
          </section>

          {/* Best ROI discovery */}
          <section className="space-y-4">
            <SectionHeader
              icon={Flame}
              title="Best ROI right now"
              subtitle="Highest return on investment this season"
              href="/cappers"
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topRoi.map((c, i) => (
                <CapperCard key={c.id} capper={c} rank={i + 1} />
              ))}
            </div>
          </section>

          {/* Join CTA */}
          <section className="border-border scl-card-gradient overflow-hidden rounded-2xl border">
            <div className="relative flex flex-col items-start gap-4 p-8 sm:p-12">
              <div
                aria-hidden
                className="scl-glow pointer-events-none absolute inset-0 -z-10 opacity-60"
              />
              <ShieldCheck className="text-brand size-8" />
              <h2 className="max-w-xl text-2xl font-bold tracking-tight text-balance sm:text-3xl">
                Build a public record. Prove your edge. Get discovered.
              </h2>
              <p className="text-muted-foreground max-w-xl">
                Every pick logged, graded, and tallied — no screenshots, no
                editing history. Climb the leaderboard and turn your record into
                a following.
              </p>
              <Button
                render={<Link href="/signup" />}
                size="lg"
                className="gap-2"
              >
                Get ranked as a capper <ArrowRight className="size-4" />
              </Button>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-border border-t">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Sports Capper League</p>
          <nav className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/responsible-gaming" className="hover:text-foreground">
              Responsible Gaming
            </Link>
            <Link href="/disclaimer" className="hover:text-foreground">
              Disclaimer
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
