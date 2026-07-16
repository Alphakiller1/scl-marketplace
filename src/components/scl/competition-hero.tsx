import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { VerificationBadge } from "@/components/scl/badges";

const PINK_CTA =
  "border-[color:var(--scl-pink)] bg-[color:var(--scl-pink)] text-[color:var(--scl-pink-ink)] hover:bg-[color:var(--scl-pink-deep)] hover:text-[color:var(--scl-pink-ink)]";

export function CompetitionHero() {
  return (
    <section
      className="border-border relative min-h-[31rem] overflow-hidden border-b bg-[color:var(--scl-ink-950)] text-[color:var(--scl-text)] sm:min-h-[35rem]"
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
          className="size-full object-contain object-right-bottom opacity-90 sm:object-right"
        />
      </picture>
      <div
        aria-hidden
        className="absolute inset-0 bg-[color:var(--scl-ink-950)]/60 sm:bg-[color:var(--scl-ink-950)]/50"
      />

      <div className="relative mx-auto flex min-h-[31rem] max-w-6xl flex-col px-4 py-8 sm:min-h-[35rem] sm:justify-center sm:px-6 sm:py-14">
        <div className="max-w-xl">
          <div className="scl-eyebrow inline-flex min-h-10 items-center gap-2 rounded-lg border border-[color:var(--scl-line)] bg-[color:var(--scl-ink-900)] px-3 font-semibold">
            <VerificationBadge size="xs" />
            Board-verified records
          </div>
          <h1
            id="scl-hero-title"
            className="scl-display mt-4 max-w-lg text-3xl leading-[1.08] font-bold tracking-[0.02em] text-balance uppercase sm:mt-5 sm:text-5xl lg:text-6xl"
          >
            Sports Capper{" "}
            <span className="text-[color:var(--scl-pink)]">Leaderboard</span>
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-pretty text-[color:var(--scl-muted-data)] sm:text-lg">
            Compare inspectable capper records by units, ROI, and sample size.
            No hype — every public pick is a receipt you can check.
          </p>
          <div className="mt-6 grid gap-3 sm:mt-7 sm:flex sm:flex-wrap">
            <Button
              render={<Link href="/leaderboard" />}
              nativeButton={false}
              size="lg"
              className={`min-h-11 w-full min-w-0 gap-2 whitespace-normal sm:w-auto ${PINK_CTA}`}
            >
              Explore Leaderboard <ArrowRight className="size-4" aria-hidden />
            </Button>
            <Button
              render={<Link href="/signup" />}
              nativeButton={false}
              size="lg"
              variant="outline"
              className="min-h-11 w-full min-w-0 border-[color:var(--scl-line)] bg-[color:var(--scl-ink-900)] whitespace-normal sm:w-auto"
            >
              Track Your Record
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
