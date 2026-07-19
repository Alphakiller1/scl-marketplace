"use client";

import type { CSSProperties } from "react";
import Link from "next/link";

import type { GradedTickerResult } from "@/lib/queries/yesterday-wins";
import { cn } from "@/lib/utils";

function formatResultUnits(
  outcome: GradedTickerResult["outcome"],
  profitUnits: number | null,
): string {
  if (outcome === "PUSH") return "0U";
  if (profitUnits == null || !Number.isFinite(profitUnits)) return "—";
  const rounded = Math.round(profitUnits * 100) / 100;
  const text = Math.abs(rounded).toFixed(2).replace(/\.00$/, "");
  if (rounded > 0) return `+${text}U`;
  if (rounded < 0) return `−${text}U`;
  return "0U";
}

function outcomeLabel(outcome: GradedTickerResult["outcome"]): string {
  switch (outcome) {
    case "WIN":
      return "Won";
    case "LOSS":
      return "Lost";
    case "PUSH":
      return "Pushed";
  }
}

function outcomeTone(outcome: GradedTickerResult["outcome"]): string {
  switch (outcome) {
    case "WIN":
      return "text-pos";
    case "LOSS":
      return "text-neg";
    case "PUSH":
      return "text-muted-foreground";
  }
}

/** Pad a short list so the marquee fills wide viewports, then duplicate for seamless -50% loop. */
function buildMarqueeItems(
  results: GradedTickerResult[],
): GradedTickerResult[] {
  if (results.length === 0) return [];
  const unit: GradedTickerResult[] = [...results];
  while (unit.length < 12) {
    unit.push(...results);
  }
  return [...unit, ...unit];
}

function TickerItem({
  result,
  className,
  interactive,
}: {
  result: GradedTickerResult;
  className?: string;
  /** When false, handle is plain text (decorative marquee / aria-hidden track). */
  interactive: boolean;
}) {
  const handle = interactive ? (
    <Link
      href={`/cappers/${result.handle}`}
      className="font-semibold text-[color:var(--scl-text)] underline decoration-[color:var(--scl-blue)] underline-offset-2 hover:decoration-[color:var(--scl-blue)]"
    >
      @{result.handle}
    </Link>
  ) : (
    <span className="font-semibold text-[color:var(--scl-text)]">
      @{result.handle}
    </span>
  );

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-full border border-[color:var(--scl-line)] bg-[color:var(--scl-ink-800)] px-3.5 py-1.5 text-sm shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]",
        className,
      )}
    >
      {handle}
      <span className="text-muted-foreground" aria-hidden>
        ·
      </span>
      <span
        className={cn(
          "scl-data shrink-0 text-xs font-semibold tracking-wide uppercase",
          outcomeTone(result.outcome),
        )}
      >
        {outcomeLabel(result.outcome)}
      </span>
      <span className="text-muted-foreground" aria-hidden>
        ·
      </span>
      <span className="text-foreground max-w-[10rem] truncate font-medium sm:max-w-[14rem]">
        {result.selection}
      </span>
      <span className="text-muted-foreground" aria-hidden>
        ·
      </span>
      <span
        className={cn(
          "scl-data font-semibold tabular-nums",
          outcomeTone(result.outcome),
        )}
      >
        {formatResultUnits(result.outcome, result.profitUnits)}
      </span>
    </span>
  );
}

/**
 * Past-tense graded results marquee (W/L/P) — hidden when empty;
 * pauses on hover/focus; static under reduced motion.
 */
export function YesterdayWinsTicker({
  wins,
  results,
  label = "Yesterday's graded results",
}: {
  /** @deprecated Prefer `results`. */
  wins?: GradedTickerResult[];
  results?: GradedTickerResult[];
  label?: "Yesterday's graded results" | "Recent graded results";
}) {
  const items = results ?? wins ?? [];
  if (items.length === 0) return null;

  const marqueeItems = buildMarqueeItems(items);
  const halfCount = marqueeItems.length / 2;
  const durationSec = Math.max(28, Math.round(halfCount * 2.8));

  return (
    <section
      aria-label={label}
      className="border-border border-b bg-[color:var(--scl-ink-900)]"
    >
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-6 lg:px-8">
        <p className="scl-eyebrow shrink-0 border-r border-[color:var(--scl-line)] pr-3 text-[color:var(--scl-muted-label)] sm:pr-4">
          {label}
        </p>

        <div
          className={cn(
            "group/ticker relative min-w-0 flex-1 overflow-hidden",
            "motion-reduce:hidden",
            "[mask-image:linear-gradient(to_right,transparent,black_1.25rem,black_calc(100%-1.25rem),transparent)]",
          )}
        >
          <div
            className="scl-ticker-track flex w-max items-center gap-2.5 group-hover/ticker:[animation-play-state:paused]"
            style={
              {
                animation: `scl-ticker ${durationSec}s linear infinite`,
              } as CSSProperties
            }
            aria-hidden="true"
          >
            {marqueeItems.map((result, i) => (
              <TickerItem
                key={`dup-${result.id}-${i}`}
                result={result}
                interactive={false}
              />
            ))}
          </div>
          <ul className="sr-only">
            {items.map((result) => (
              <li key={result.id}>
                <Link href={`/cappers/${result.handle}`}>@{result.handle}</Link>
                {" · "}
                {outcomeLabel(result.outcome)} · {result.selection} ·{" "}
                {formatResultUnits(result.outcome, result.profitUnits)}
              </li>
            ))}
          </ul>
        </div>

        <ul className="hidden min-w-0 flex-1 flex-wrap items-center gap-2 motion-reduce:flex">
          {items.map((result) => (
            <li key={`static-${result.id}`}>
              <TickerItem result={result} interactive />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
