"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Matches the hero carousel's dwell so the page has one rhythm, not two. */
const AUTO_MS = 6500;

export type BoardWindowView = {
  id: string;
  /** Chip text, e.g. "30D". */
  label: string;
  /** Announced to screen readers instead of the bare chip. */
  title: string;
};

/**
 * Rotates a leaderboard snapshot across time windows, the way the hero rotates
 * slides.
 *
 * Each window is rendered on the server and passed in as a child — only the
 * active one is shown. Keeping the table server-rendered means rotating costs
 * no extra queries and no client-side leaderboard maths; the whole interaction
 * is which sibling is visible.
 *
 * Rotation stops on hover and on focus, so nobody loses a row they were
 * reading or tabbing through, and it never starts under
 * `prefers-reduced-motion`. Both are the same rules the hero already follows.
 */
export function BoardWindowRotator({
  views,
  children,
  className,
  label = "Leaderboard windows",
}: {
  views: BoardWindowView[];
  children: ReactNode[];
  className?: string;
  label?: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const count = views.length;
  const go = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (paused || count < 2) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => go(index + 1), AUTO_MS);
    return () => window.clearInterval(id);
  }, [go, index, paused, count]);

  if (count === 0) return null;
  const active = views[index] ?? views[0]!;

  return (
    <div
      className={cn("min-w-0", className)}
      aria-roledescription="carousel"
      aria-label={label}
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      <p className="sr-only">
        Showing {active.title}. Window {index + 1} of {count}.
      </p>

      {count > 1 ? (
        <div
          className="mb-2 flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Choose leaderboard window"
        >
          {views.map((view, i) => {
            const isActive = i === index;
            return (
              <button
                key={view.id}
                type="button"
                onClick={() => {
                  setIndex(i);
                  // A deliberate choice outranks the rotation — stop moving.
                  setPaused(true);
                }}
                aria-pressed={isActive}
                aria-label={`Show ${view.title}`}
                className={cn(
                  "scl-data inline-flex h-7 min-w-9 items-center justify-center rounded-[var(--scl-radius-chip)] px-2 text-[0.68rem] leading-none font-semibold tracking-[0.08em] uppercase transition-colors",
                  isActive
                    ? "bg-[color:var(--scl-blue)] text-[color:var(--scl-blue-ink)]"
                    : "border-border text-muted-foreground hover:text-foreground border bg-transparent",
                )}
              >
                {view.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Stacked in one grid cell so swapping windows never shifts the page. */}
      <div className="grid min-w-0">
        {children.map((child, i) => {
          const isActive = i === index;
          return (
            <div
              key={views[i]?.id ?? i}
              className={cn(
                "col-start-1 row-start-1 min-w-0 transition-opacity duration-500 ease-out motion-reduce:transition-none",
                isActive
                  ? "z-10 opacity-100"
                  : "pointer-events-none z-0 opacity-0",
              )}
              aria-hidden={!isActive}
              inert={!isActive}
            >
              {child}
            </div>
          );
        })}
      </div>
    </div>
  );
}
