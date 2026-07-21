"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { VerificationBadge } from "@/components/scl/badges";
import { HERO_SLIDES } from "@/lib/hero-slides";
import { cn } from "@/lib/utils";

const PINK_CTA =
  "border-[color:var(--scl-pink)] bg-[color:var(--scl-pink)] text-[color:var(--scl-pink-ink)] hover:bg-[color:var(--scl-pink-deep)] hover:text-[color:var(--scl-pink-ink)]";

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

  return (
    <section
      className="relative w-full overflow-hidden border-b border-[color:var(--scl-hero-line)] bg-[color:var(--scl-hero-ink)] text-[color:var(--scl-hero-text)] [--ring:var(--scl-hero-blue)]"
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
      {/* Atmosphere only — no photographic trophy/hero plate behind the board. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_80%_at_78%_48%,rgba(16,95,217,0.18),transparent_55%),radial-gradient(70%_70%_at_18%_40%,rgba(166,0,127,0.12),transparent_50%),linear-gradient(180deg,var(--scl-hero-ink),var(--scl-hero-ink-raised))]"
      />

      <div className="relative mx-auto grid w-full max-w-[1400px] gap-8 px-4 py-7 sm:px-6 sm:py-9 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.95fr)] lg:items-center lg:gap-10 lg:px-8 lg:py-10">
        <div className="min-w-0">
          <div className="grid max-w-[36rem]">
            {HERO_SLIDES.map((slide, i) => {
              const active = i === index;
              return (
                <div
                  key={slide.id}
                  className={cn(
                    "col-start-1 row-start-1 transition-opacity duration-300 ease-out motion-reduce:transition-none",
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
                    className="scl-display mt-3 max-w-[20ch] text-[2.375rem] leading-10 font-bold tracking-[0.01em] text-balance normal-case sm:mt-4 sm:text-[3.5rem] sm:leading-none"
                  >
                    <Link
                      href={slide.href}
                      tabIndex={active ? undefined : -1}
                      className="focus-visible:ring-ring rounded-sm text-[color:var(--scl-hero-text)] transition-colors hover:text-[color:var(--scl-hero-pink-text)] focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {slide.title}
                    </Link>
                  </h1>

                  <p className="mt-4 max-w-[34rem] text-base leading-relaxed text-pretty text-[color:var(--scl-hero-muted)] sm:text-[1.05rem]">
                    {slide.body}
                  </p>

                  <div className="mt-6 flex flex-wrap items-center gap-3">
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

          <div className="mt-7 flex items-center gap-2 sm:mt-8">
            <button
              type="button"
              onClick={() => go(index - 1)}
              className="focus-visible:ring-ring inline-flex size-11 items-center justify-center rounded-lg border border-[color:var(--scl-hero-line)] bg-[color:var(--scl-hero-ink-raised)]/80 text-[color:var(--scl-hero-muted)] backdrop-blur-sm hover:text-[color:var(--scl-hero-text)] focus-visible:ring-2 focus-visible:outline-none"
              aria-label="Previous slide"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>

            <div
              className="flex items-center"
              role="tablist"
              aria-label="Hero slides"
            >
              {HERO_SLIDES.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Show slide ${i + 1}: ${s.title}`}
                  onClick={() => setIndex(i)}
                  className="group focus-visible:ring-ring inline-flex size-11 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:outline-none"
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
              className="focus-visible:ring-ring inline-flex size-11 items-center justify-center rounded-lg border border-[color:var(--scl-hero-line)] bg-[color:var(--scl-hero-ink-raised)]/80 text-[color:var(--scl-hero-muted)] backdrop-blur-sm hover:text-[color:var(--scl-hero-text)] focus-visible:ring-2 focus-visible:outline-none"
              aria-label="Next slide"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        {board ? (
          <div className="relative min-w-0 pb-8 lg:pb-6">{board}</div>
        ) : null}
      </div>
    </section>
  );
}
