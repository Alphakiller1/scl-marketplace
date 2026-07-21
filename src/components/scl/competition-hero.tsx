"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { VerificationBadge } from "@/components/scl/badges";
import { HERO_SLIDES } from "@/lib/hero-slides";
import { cn } from "@/lib/utils";

const AUTO_MS = 6500;

export function CompetitionHero({ board }: { board?: ReactNode }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback((next: number) => {
    setIndex((next + HERO_SLIDES.length) % HERO_SLIDES.length);
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

  const activeSlide = HERO_SLIDES[index] ?? HERO_SLIDES[0];

  return (
    <section
      className="relative w-full overflow-hidden border-b border-[color:var(--scl-hero-line)] bg-[color:var(--scl-hero-ink)] text-[color:var(--scl-hero-text)] [--ring:var(--scl-hero-blue)]"
      aria-roledescription="carousel"
      aria-label="SCL Highlights"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      {/* Atmosphere only — no photographic trophy/hero plate behind the board. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_80%_at_78%_48%,rgba(16,95,217,0.18),transparent_55%),radial-gradient(70%_70%_at_18%_40%,rgba(166,0,127,0.12),transparent_50%),linear-gradient(180deg,var(--scl-hero-ink),var(--scl-hero-ink-raised))]"
      />

      <p className="sr-only">
        Slide {index + 1} Of {HERO_SLIDES.length}: {activeSlide.title}
      </p>

      {/* Board rail must host Rank-schema width — prefer board share over copy. */}
      <div className="relative mx-auto grid w-full max-w-[1400px] gap-10 px-4 py-9 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(26rem,1.15fr)] lg:items-start lg:gap-10 lg:px-8 lg:py-12">
        <div className="min-w-0">
          <div className="grid max-w-[36rem]">
            {HERO_SLIDES.map((slide, i) => {
              const active = i === index;
              return (
                <div
                  key={slide.id}
                  className={cn(
                    "col-start-1 row-start-1 transition-opacity duration-500 ease-out motion-reduce:transition-none",
                    active
                      ? "z-10 opacity-100"
                      : "pointer-events-none z-0 opacity-0",
                  )}
                  aria-hidden={!active}
                >
                  <p className="scl-eyebrow text-[color:var(--scl-pink)]">
                    <span className="inline-flex items-center gap-1.5">
                      <VerificationBadge size="xs" />
                      {slide.eyebrow}
                    </span>
                  </p>

                  <h1
                    id={active ? "scl-hero-title" : undefined}
                    className="scl-display mt-4 max-w-[20ch] text-[2.125rem] leading-[1.15] font-bold tracking-[0.01em] text-balance normal-case sm:mt-4 sm:text-[3.5rem] sm:leading-none"
                  >
                    <Link
                      href={slide.href}
                      tabIndex={active ? undefined : -1}
                      className="focus-visible:ring-ring rounded-sm text-[color:var(--scl-hero-text)] transition-colors hover:text-[color:var(--scl-hero-pink-text)] focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {slide.title}
                    </Link>
                  </h1>

                  <p className="mt-5 max-w-[34rem] text-base leading-relaxed text-pretty text-[color:var(--scl-hero-muted)] sm:text-[1.05rem]">
                    {slide.body}
                  </p>

                  <div className="mt-7 flex flex-wrap items-center gap-3">
                    <Button
                      render={
                        <Link
                          href={slide.href}
                          tabIndex={active ? undefined : -1}
                        />
                      }
                      nativeButton={false}
                      variant="brand"
                      size="lg"
                      className="min-h-11 gap-2"
                    >
                      {slide.cta}
                      <ArrowRight className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {board ? (
          <div className="relative min-w-0 pb-8 lg:pb-6">{board}</div>
        ) : null}
      </div>
    </section>
  );
}
