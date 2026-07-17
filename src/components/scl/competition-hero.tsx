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
    id: "discover",
    eyebrow: "Discover Performance",
    title: "Find Cappers Whose Records Hold Up",
    body: "Compare board-verified units, ROI, and sample size — then open today's picks and inspect the receipts before you follow anyone off-platform.",
    href: "/picks",
    cta: "View Latest Picks",
  },
  {
    id: "verify",
    eyebrow: "Inspect Before You Follow",
    title: "Every Pick, Timestamp, And Result Is Public",
    body: "SCL ranks transparent records — not hype. Check verification tiers, graded history, and leaderboard sample thresholds before you trust a name.",
    href: "/leaderboard",
    cta: "Explore Leaderboard",
  },
  {
    id: "founding",
    eyebrow: "For Serious Cappers",
    title: "Build A Record People Can Inspect",
    body: "Log board-verified plays from day one and earn a public rank others can check. Keep payments on your own storefront — SCL does not process them.",
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
      className="border-border relative min-h-[31rem] overflow-hidden border-b bg-[color:var(--scl-ink-950)] text-[color:var(--scl-text)] sm:min-h-[36rem]"
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
      {/* Layer 1 — single full-bleed scene (no cover/contain dual stack) */}
      <picture className="pointer-events-none absolute inset-0">
        <source
          media="(min-width: 640px)"
          srcSet="/assets/scl/leaderboard-trophy-desktop.webp?v=20260717g"
        />
        <img
          src="/assets/scl/leaderboard-trophy-mobile.webp?v=20260717g"
          alt=""
          width="1080"
          height="1920"
          fetchPriority="high"
          className="size-full object-cover object-center opacity-95"
        />
      </picture>
      {/* Layers 2–4 — ink scrims for copy contrast only (no hue shift) */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[color:var(--scl-ink-950)]/25"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-[color:var(--scl-ink-950)]/40 via-[color:var(--scl-ink-950)]/15 to-transparent"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-[color:var(--scl-ink-950)]/35 via-transparent to-[color:var(--scl-ink-950)]/10"
      />

      <div className="relative mx-auto flex min-h-[31rem] max-w-6xl flex-col px-4 py-8 sm:min-h-[36rem] sm:justify-center sm:px-6 sm:py-14">
        {/*
          Layer 5 — stack every slide in one grid cell so the tallest copy owns
          height. Opacity-only swaps avoid translateY remount rumble.
        */}
        <div className="grid max-w-xl">
          {SLIDES.map((slide, i) => {
            const active = i === index;
            return (
              <div
                key={slide.id}
                className={cn(
                  "col-start-1 row-start-1 rounded-2xl border border-[color:var(--scl-line)]/50 bg-[color:var(--scl-ink-950)]/55 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-md transition-opacity duration-300 ease-out motion-reduce:transition-none sm:p-7",
                  active
                    ? "z-10 opacity-100"
                    : "pointer-events-none z-0 opacity-0",
                )}
                aria-hidden={!active}
              >
                <div className="scl-data inline-flex min-h-10 items-center gap-2 rounded-lg border border-[color:var(--scl-line)] bg-[color:var(--scl-ink-900)]/80 px-3 text-[0.625rem] font-semibold tracking-[0.16em] uppercase">
                  <VerificationBadge size="xs" />
                  {slide.eyebrow}
                </div>

                <h1
                  id={active ? "scl-hero-title" : undefined}
                  className="scl-display mt-4 max-w-lg text-3xl leading-[1.08] font-bold tracking-[0.02em] text-balance uppercase sm:mt-5 sm:text-5xl lg:text-6xl"
                >
                  <Link
                    href={slide.href}
                    tabIndex={active ? undefined : -1}
                    className="focus-visible:ring-ring rounded-sm transition-colors hover:text-[color:var(--scl-pink)] focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {slide.title}
                  </Link>
                </h1>

                <p className="mt-4 max-w-lg text-base leading-relaxed text-pretty text-[color:var(--scl-muted-data)] sm:text-lg">
                  {slide.body}
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-7">
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
        <div className="mt-8 flex items-center gap-3 sm:mt-10">
          <button
            type="button"
            onClick={() => go(index - 1)}
            className="border-border text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-9 items-center justify-center rounded-lg border bg-[color:var(--scl-ink-900)]/80 backdrop-blur-sm focus-visible:ring-2 focus-visible:outline-none"
            aria-label="Previous slide"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>

          <div
            className="flex items-center gap-2"
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
                className={cn(
                  "focus-visible:ring-ring h-2 rounded-full transition-[width,background-color] duration-300 ease-out focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none",
                  i === index
                    ? "w-7 bg-[color:var(--scl-blue)]"
                    : "bg-muted-foreground/40 hover:bg-muted-foreground/70 w-2",
                )}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => go(index + 1)}
            className="border-border text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-9 items-center justify-center rounded-lg border bg-[color:var(--scl-ink-900)]/80 backdrop-blur-sm focus-visible:ring-2 focus-visible:outline-none"
            aria-label="Next slide"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>

          <p className="scl-data text-muted-foreground ml-1 text-xs tabular-nums">
            {index + 1} / {SLIDES.length}
          </p>
        </div>
      </div>
    </section>
  );
}
