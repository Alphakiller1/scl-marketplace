import Link from "next/link";
import { ArrowRight, ShieldCheck, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { VerificationBadge } from "@/components/scl/badges";
import type { LeaderboardSummary } from "@/lib/leaderboard";
import { formatPct, formatRoi, formatUnits } from "@/lib/format";

export function CompetitionHero({ summary }: { summary: LeaderboardSummary }) {
  return (
    <section
      className="border-border relative min-h-[540px] overflow-hidden border-b sm:min-h-[560px]"
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
          className="size-full object-cover object-bottom sm:object-center"
        />
      </picture>
      <div aria-hidden className="bg-background/45 absolute inset-0" />

      <div className="relative mx-auto flex min-h-[540px] max-w-6xl flex-col justify-between px-4 py-10 sm:min-h-[560px] sm:px-6 sm:py-14">
        <div className="max-w-xl">
          <div className="border-border-strong bg-background/75 inline-flex min-h-8 items-center gap-2 rounded-lg border px-3 text-xs font-semibold backdrop-blur-sm">
            <VerificationBadge size="xs" />
            Public performance records
          </div>
          <h1
            id="scl-hero-title"
            className="mt-5 max-w-lg text-4xl font-extrabold text-balance sm:text-6xl"
          >
            Sports Capper <span className="scl-brand-text">Leaderboard</span>
          </h1>
          <p className="text-foreground/85 mt-4 max-w-lg text-base leading-relaxed text-pretty sm:text-lg">
            Compare tracked records, evaluate long-term performance, and see
            which handicappers are earning their rank.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              render={<Link href="/leaderboard" />}
              nativeButton={false}
              size="lg"
              className="gap-2"
            >
              Explore leaderboard <ArrowRight className="size-4" aria-hidden />
            </Button>
            <Button
              render={<Link href="/signup" />}
              nativeButton={false}
              size="lg"
              variant="outline"
              className="bg-background/60 backdrop-blur-sm"
            >
              Become a capper
            </Button>
          </div>
        </div>

        <dl className="border-border bg-background/75 grid max-w-3xl grid-cols-2 overflow-hidden rounded-xl border backdrop-blur-md sm:grid-cols-4">
          <HeroMetric
            icon={Trophy}
            label="Ranked cappers"
            value={summary.rankedCappers.toLocaleString()}
          />
          <HeroMetric
            icon={ShieldCheck}
            label="Verified"
            value={summary.verifiedCappers.toLocaleString()}
          />
          <HeroMetric
            label="Tracked picks"
            value={summary.trackedPicks.toLocaleString()}
          />
          <HeroMetric
            label="Platform ROI"
            value={summary.trackedPicks ? formatRoi(summary.roi) : "—"}
            detail={
              summary.trackedPicks
                ? `${formatPct(summary.winPct)} win rate · ${formatUnits(summary.netUnits)}`
                : "Awaiting graded plays"
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
        <p className="text-muted-foreground mt-0.5 truncate text-xs">
          {detail}
        </p>
      ) : null}
    </div>
  );
}
