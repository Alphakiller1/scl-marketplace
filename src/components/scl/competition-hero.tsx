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
    eyebrow: "Build a public record",
    title: "Build a record people can inspect",
    body: "Log each pick with its timestamp, submitted line, verification state, and result in units.",
    href: "/signup",
    cta: "Track Your Record",
  },
  {
    id: "discover",
    eyebrow: "Discover cappers",
    title: "Compare records on the same terms",
    body: "Compare units, ROI, sample maturity, and board-verified share within the same scope.",
    href: "/leaderboard",
    cta: "Explore Leaderboard",
  },
  {
    id: "verify",
    eyebrow: "Track & verify",
    title: "Track your picks. Keep your storefront.",
    body: "Build a public rank with board-verified plays and use your own storefront. SCL does not process payments.",
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
      className="border-border relative min-h-[31rem] w-full overflow-hidden border-b bg-[color:var(--scl-ink-950)] text-[color:var(--scl-text)] sm:min-h-[36rem]"
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
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_80%_at_70%_55%,rgba(16,95,217,0.21),transparent_55%),radial-gradient(70%_70%_at_25%_45%,rgba(166,0,127,0.16),transparent_50%),linear-gradient(180deg,var(--scl-ink-950),var(--scl-ink-900))]"
      />
      {/* Layer 1 — original-design bleed (object-cover) so the hero is edge-to-edge */}
      <picture className="pointer-events-none absolute inset-0 block size-full">
        <source
          media="(min-width: 640px)"
          srcSet="/assets/scl/leaderboard-hero-atmosphere-desktop.webp?v=20260717f5"
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
      {/* Layer 2 — opaque original trophy scene (object-contain); leave framing as-designed */}
      <picture className="pointer-events-none absolute inset-0 block size-full">
        <source
          media="(min-width: 640px)"
          srcSet="/assets/scl/leaderboard-trophy-desktop.webp?v=20260717f5"
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
        className="absolute inset-0 bg-gradient-to-r from-[color:var(--scl-ink-950)]/55 via-[color:var(--scl-ink-950)]/14 to-transparent"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-[color:var(--scl-ink-950)]/32 via-transparent to-[color:var(--scl-ink-950)]/10"
      />

      <div className="relative mx-auto flex min-h-[31rem] w-full max-w-6xl flex-col px-4 py-8 sm:min-h-[36rem] sm:justify-center sm:px-6 sm:py-14">
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
                  "col-start-1 row-start-1 rounded-2xl border border-[color:var(--scl-line)]/70 bg-[color:var(--scl-ink-950)]/78 p-6 shadow-[0_16px_48px_rgba(0,0,0,0.42)] backdrop-blur-md transition-opacity duration-300 ease-out motion-reduce:transition-none sm:p-8",
                  active
                    ? "z-10 opacity-100"
                    : "pointer-events-none z-0 opacity-0",
                )}
                aria-hidden={!active}
              >
                <div className="scl-data inline-flex min-h-10 items-center gap-2 rounded-lg border border-[color:var(--scl-line)] bg-[color:var(--scl-ink-900)]/90 px-3 text-[0.625rem] font-semibold tracking-[0.16em] uppercase">
                  <VerificationBadge size="xs" />
                  {slide.eyebrow}
                </div>

                <h1
                  id={active ? "scl-hero-title" : undefined}
                  className="scl-display mt-5 max-w-lg text-3xl leading-[1.08] font-bold tracking-[0.02em] text-balance normal-case sm:mt-6 sm:text-5xl lg:text-6xl"
                >
                  <Link
                    href={slide.href}
                    tabIndex={active ? undefined : -1}
                    className="focus-visible:ring-ring rounded-sm text-[color:var(--scl-text)] underline-offset-4 transition-colors hover:underline hover:decoration-[color:var(--scl-pink)] focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {slide.title}
                  </Link>
                </h1>

                <p className="mt-5 max-w-lg text-base leading-relaxed text-pretty text-[color:var(--scl-muted-data)] sm:mt-5 sm:text-lg">
                  {slide.body}
                </p>

                <div className="mt-7 flex flex-wrap items-center gap-3 sm:mt-8">
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
