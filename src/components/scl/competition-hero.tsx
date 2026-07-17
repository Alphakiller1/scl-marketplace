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
    cta: "Apply As A Founding Capper",
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
  const slide = SLIDES[index] ?? SLIDES[0];

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
      {/* Single full-bleed scene — one image, one scale (no cover/contain stack) */}
      <picture className="pointer-events-none absolute inset-0">
        <source
          media="(min-width: 640px)"
          srcSet="/assets/scl/leaderboard-trophy-desktop.webp"
        />
        <img
          src="/assets/scl/leaderboard-trophy-mobile.webp"
          alt=""
          width="1080"
          height="1920"
          fetchPriority="high"
          className="size-full object-cover object-center opacity-95"
        />
      </picture>
      {/* Soft scrim for copy contrast only — keep light so gold crown + lighter blues read */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[color:var(--scl-ink-950)]/15"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-[color:var(--scl-ink-950)]/32 via-[color:var(--scl-ink-950)]/10 to-transparent"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-[color:var(--scl-ink-950)]/28 via-transparent to-[color:var(--scl-ink-950)]/8"
      />

      <div className="relative mx-auto flex min-h-[31rem] max-w-6xl flex-col px-4 py-8 sm:min-h-[36rem] sm:justify-center sm:px-6 sm:py-14">
        <div
          key={slide.id}
          className="scl-reveal max-w-xl rounded-2xl border border-[color:var(--scl-line)]/50 bg-[color:var(--scl-ink-950)]/55 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-7"
        >
          <div className="scl-data inline-flex min-h-10 items-center gap-2 rounded-lg border border-[color:var(--scl-line)] bg-[color:var(--scl-ink-900)]/80 px-3 text-[0.625rem] font-semibold tracking-[0.16em] uppercase">
            <VerificationBadge size="xs" />
            {slide.eyebrow}
          </div>

          <h1
            id="scl-hero-title"
            className="scl-display mt-4 max-w-lg text-3xl leading-[1.08] font-bold tracking-[0.02em] text-balance uppercase sm:mt-5 sm:text-5xl lg:text-6xl"
          >
            <Link
              href={slide.href}
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
              render={<Link href={slide.href} />}
              nativeButton={false}
              size="lg"
              className={`min-h-11 gap-2 ${PINK_CTA}`}
            >
              {slide.cta}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>

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
                  "focus-visible:ring-ring h-2 rounded-full transition-all focus-visible:ring-2 focus-visible:outline-none",
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
