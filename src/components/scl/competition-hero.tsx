import Link from "next/link";
import { ArrowRight, ShieldCheck, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { VerificationBadge } from "@/components/scl/badges";
import type { LeaderboardSummary } from "@/lib/leaderboard";
import { formatPct, formatRoi, formatUnits } from "@/lib/format";

export function CompetitionHero({ summary }: { summary: LeaderboardSummary }) {
  return (
    <section
      className="dark border-border bg-background text-foreground relative min-h-[34rem] overflow-hidden border-b sm:min-h-[35rem]"
      aria-labelledby="scl-hero-title"
    >
      <picture className="absolute inset-0">
        <source
          media="(min-width: 640px)"
          srcSet="/assets/scl/leaderboard-trophy-desktop.webp"
        />
        <img
          src="/assets/scl/leaderboard-trophy-mobile.webp"
          alt=""
          width="852"
          height="1846"
          fetchPriority="high"
          className="size-full object-contain object-right-bottom sm:object-right"
        />
      </picture>
      <div
        aria-hidden
        className="bg-background/55 sm:bg-background/45 absolute inset-0"
      />

      <div className="relative mx-auto flex min-h-[34rem] max-w-6xl flex-col justify-between gap-8 px-4 py-8 sm:min-h-[35rem] sm:px-6 sm:py-14">
        <div className="max-w-xl">
          <div className="border-border-strong bg-background/75 inline-flex min-h-8 items-center gap-2 rounded-lg border px-3 text-xs font-semibold backdrop-blur-sm">
            <VerificationBadge size="xs" />
            Public Performance Records
          </div>
          <h1
            id="scl-hero-title"
            className="mt-4 max-w-lg text-3xl leading-[1.08] font-extrabold text-balance sm:mt-5 sm:text-5xl lg:text-6xl"
          >
            Sports Capper <span className="scl-brand-text">Leaderboard</span>
          </h1>
          <p className="text-foreground/85 mt-4 max-w-lg text-base leading-relaxed text-pretty sm:text-lg">
            Compare tracked records, evaluate long-term performance, and see
            which handicappers are earning their rank.
          </p>
          <div className="mt-6 grid gap-3 sm:mt-7 sm:flex sm:flex-wrap">
            <Button
              render={<Link href="/leaderboard" />}
              nativeButton={false}
              size="lg"
              className="min-h-11 w-full min-w-0 gap-2 whitespace-normal sm:min-h-9 sm:w-auto"
            >
              Explore Leaderboard <ArrowRight className="size-4" aria-hidden />
            </Button>
            <Button
              render={<Link href="/signup" />}
              nativeButton={false}
              size="lg"
              variant="outline"
              className="bg-background/60 min-h-11 w-full min-w-0 whitespace-normal backdrop-blur-sm sm:min-h-9 sm:w-auto"
            >
              Become A Capper
            </Button>
          </div>
        </div>

        <dl className="border-border bg-background/75 grid max-w-3xl grid-cols-2 overflow-hidden rounded-xl border backdrop-blur-md sm:grid-cols-4">
          <HeroMetric
            icon={Trophy}
            label="Ranked Cappers"
            value={summary.rankedCappers.toLocaleString()}
          />
          <HeroMetric
            icon={ShieldCheck}
            label="Verified"
            value={summary.verifiedCappers.toLocaleString()}
          />
          <HeroMetric
            label="Tracked Picks"
            value={summary.trackedPicks.toLocaleString()}
          />
          <HeroMetric
            label="Platform ROI"
            value={summary.trackedPicks ? formatRoi(summary.roi) : "—"}
            detail={
              summary.trackedPicks
                ? `${formatPct(summary.winPct)} win rate · ${formatUnits(summary.netUnits)}`
                : "Awaiting Graded Plays"
            }
          />
        </dl>
      </div>
    </section>
  );
}

function HeroMetric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="border-border min-w-0 border-r border-b p-3 last:border-r-0 sm:border-b-0 sm:p-4">
      <dt className="text-muted-foreground flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase">
        {Icon ? <Icon className="text-brand size-3.5" aria-hidden /> : null}
        {label}
      </dt>
      <dd className="nums mt-1 text-xl font-bold tabular-nums sm:text-2xl">
        {value}
      </dd>
      {detail ? (
        <p className="text-muted-foreground mt-0.5 text-xs leading-snug sm:truncate">
          {detail}
        </p>
      ) : null}
    </div>
  );
}
