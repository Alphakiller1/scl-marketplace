"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { VerificationBadge } from "@/components/scl/badges";
import { cn } from "@/lib/utils";

const PINK_CTA =
  "border-[color:var(--scl-pink)] bg-[color:var(--scl-pink)] text-[color:var(--scl-pink-ink)] hover:bg-[color:var(--scl-pink-deep)] hover:text-[color:var(--scl-pink-ink)]";

const AUTO_MS = 6500;

type HeroSlide = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  cta: string;
};

const SLIDES: HeroSlide[] = [
  {
    id: "founding",
    eyebrow: "Founding Roster Forming",
    title: "Apply As A Founding Capper",
    body: "Build a public, inspectable record from day one — every pick, timestamp, line, and result visible before you send bettors anywhere.",
    href: "/signup",
    cta: "Track Your Record",
  },
  {
    id: "discover",
    eyebrow: "Discover Cappers",
    title: "Find & Tail The Best Cappers In The World",
    body: "Compare board-verified records by units, ROI, and sample size — then follow the cappers whose process holds up under inspection.",
    href: "/leaderboard",
    cta: "Explore Leaderboard",
  },
  {
    id: "verify",
    eyebrow: "Track & Verify",
    title: "Sell, Track, & Verify Your Predictions",
    body: "Log board-verified plays, earn a public rank others can check, and keep payments on your own storefront. SCL does not process payments.",
    href: "/signup",
    cta: "Track Your Record",
  },
];

export function CompetitionHero() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback((next: number) => {
    setIndex((next + SLIDES.length) % SLIDES.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => go(index + 1), AUTO_MS);
    return () => window.clearInterval(id);
  }, [go, index, paused]);

  return (
    <section
      className="relative min-h-[31rem] w-full overflow-hidden border-b border-[color:var(--scl-hero-line)] bg-[color:var(--scl-hero-ink)] text-[color:var(--scl-hero-text)] [--ring:var(--scl-hero-blue)] sm:min-h-[32rem]"
      aria-roledescription="carousel"
      aria-label="SCL highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      {/* Soft ink fallback under bitmaps — bloom ~18% quieter than prior */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_80%_at_70%_55%,rgba(16,95,217,0.21),transparent_55%),radial-gradient(70%_70%_at_25%_45%,rgba(166,0,127,0.16),transparent_50%),linear-gradient(180deg,var(--scl-hero-ink),var(--scl-hero-ink-raised))]"
      />
      {/* Desktop uses one integrated banner; mobile keeps its purpose-built atmosphere. */}
      <picture className="pointer-events-none absolute inset-0 block size-full">
        <source
          media="(min-width: 640px)"
          srcSet="/assets/scl/leaderboard-hero-integrated-v4.webp"
        />
        <img
          src="/assets/scl/leaderboard-hero-atmosphere-mobile.webp?v=20260717f5"
          alt=""
          width="2400"
          height="1200"
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 size-full max-w-none object-cover object-center opacity-[0.84]"
        />
      </picture>
      {/* Mobile-only trophy; the desktop trophy is integrated into the banner above. */}
      <picture className="pointer-events-none absolute inset-0 block size-full sm:hidden">
        <source
          media="(min-width: 640px)"
          srcSet="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
        />
        <img
          src="/assets/scl/leaderboard-trophy-mobile.webp?v=20260717f5"
          alt=""
          width="1920"
          height="1280"
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 size-full max-w-none object-contain object-center opacity-[0.88]"
        />
      </picture>
      {/* Ink scrims for copy contrast — slightly stronger so the panel reads first */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-[color:var(--scl-hero-ink)]/55 via-[color:var(--scl-hero-ink)]/14 to-transparent"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-[color:var(--scl-hero-ink)]/32 via-transparent to-[color:var(--scl-hero-ink)]/10"
      />

      <div className="relative mx-auto flex min-h-[31rem] w-full max-w-[1400px] flex-col px-4 py-8 sm:min-h-[32rem] sm:justify-center sm:px-6 sm:py-10 lg:px-8">
        {/*
          Layer 5 — stack every slide in one grid cell so the tallest copy owns
          height. Opacity-only swaps avoid translateY remount rumble.
        */}
        <div className="grid max-w-[35rem]">
          {SLIDES.map((slide, i) => {
            const active = i === index;
            return (
              <div
                key={slide.id}
                className={cn(
                  "col-start-1 row-start-1 border-l-2 border-[color:var(--scl-pink-deep)] py-2 pr-2 pl-5 drop-shadow-[0_12px_36px_rgba(0,0,0,0.72)] transition-opacity duration-300 ease-out motion-reduce:transition-none sm:py-3 sm:pl-7",
                  active
                    ? "z-10 opacity-100"
                    : "pointer-events-none z-0 opacity-0",
                )}
                aria-hidden={!active}
              >
                <div className="scl-data inline-flex min-h-9 items-center gap-2 rounded-lg border border-[color:var(--scl-hero-line)] bg-[color:var(--scl-hero-ink)]/72 px-3 text-[0.625rem] font-semibold tracking-[0.16em] uppercase">
                  <VerificationBadge size="xs" />
                  {slide.eyebrow}
                </div>

                <h1
                  id={active ? "scl-hero-title" : undefined}
                  className="scl-display mt-5 max-w-[35rem] text-4xl leading-[0.98] font-bold tracking-[0.01em] normal-case sm:text-6xl"
                >
                  <Link
                    href={slide.href}
                    tabIndex={active ? undefined : -1}
                    className="focus-visible:ring-ring rounded-sm text-[color:var(--scl-hero-text)] transition-colors hover:text-[color:var(--scl-hero-pink-text)] focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {slide.title}
                  </Link>
                </h1>

                <p className="mt-5 max-w-[34rem] text-base leading-relaxed text-pretty text-[color:var(--scl-hero-muted)] sm:mt-4 sm:text-lg">
                  {slide.body}
                </p>

                <div className="mt-7 flex flex-wrap items-center gap-3 sm:mt-6">
                  <Button
                    render={
                      <Link
                        href={slide.href}
                        tabIndex={active ? undefined : -1}
                      />
                    }
                    nativeButton={false}
                    size="lg"
                    className={`min-h-11 gap-2 ${PINK_CTA}`}
                  >
                    {slide.cta}
                    <ArrowRight className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Layer 6 — controls outside the slide panel */}
        <div className="mt-8 flex items-center gap-3 sm:mt-6">
          <button
            type="button"
            onClick={() => go(index - 1)}
            className="focus-visible:ring-ring inline-flex size-10 items-center justify-center rounded-lg border border-[color:var(--scl-hero-line)] bg-[color:var(--scl-hero-ink-raised)]/80 text-[color:var(--scl-hero-muted)] backdrop-blur-sm hover:text-[color:var(--scl-hero-text)] focus-visible:ring-2 focus-visible:outline-none"
            aria-label="Previous slide"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>

          <div
            className="flex items-center"
            role="tablist"
            aria-label="Hero slides"
          >
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Show slide ${i + 1}: ${s.title}`}
                onClick={() => setIndex(i)}
                className="group focus-visible:ring-ring inline-flex size-10 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:outline-none"
              >
                <span
                  aria-hidden
                  className={cn(
                    "block h-2 rounded-full transition-[width,background-color] duration-300 ease-out motion-reduce:transition-none",
                    i === index
                      ? "w-7 bg-[color:var(--scl-hero-blue)]"
                      : "w-2 bg-[color:var(--scl-hero-muted)]/40 group-hover:bg-[color:var(--scl-hero-muted)]/70",
                  )}
                />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => go(index + 1)}
            className="focus-visible:ring-ring inline-flex size-10 items-center justify-center rounded-lg border border-[color:var(--scl-hero-line)] bg-[color:var(--scl-hero-ink-raised)]/80 text-[color:var(--scl-hero-muted)] backdrop-blur-sm hover:text-[color:var(--scl-hero-text)] focus-visible:ring-2 focus-visible:outline-none"
            aria-label="Next slide"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>

          <p className="scl-data ml-1 text-xs text-[color:var(--scl-hero-muted)] tabular-nums">
            {index + 1} / {SLIDES.length}
          </p>
        </div>
      </div>
    </section>
  );
}
