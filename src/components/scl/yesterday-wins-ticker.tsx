"use client";

import type { CSSProperties } from "react";
import Link from "next/link";

import type { YesterdayGradedWin } from "@/lib/queries/yesterday-wins";
import { cn } from "@/lib/utils";

function formatWinUnits(units: number): string {
  const rounded = Math.round(units * 100) / 100;
  const text = rounded.toFixed(2).replace(/\.00$/, "");
  return `+${text}U`;
}

/** Pad a short win list so the marquee fills wide viewports, then duplicate for seamless -50% loop. */
function buildMarqueeItems(wins: YesterdayGradedWin[]): YesterdayGradedWin[] {
  if (wins.length === 0) return [];
  const unit: YesterdayGradedWin[] = [...wins];
  while (unit.length < 12) {
    unit.push(...wins);
  }
  return [...unit, ...unit];
}

function TickerItem({
  win,
  className,
}: {
  win: YesterdayGradedWin;
  className?: string;
}) {
  const profit = win.profitUnits > 0 ? win.profitUnits : win.units;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-full border border-[color:var(--scl-line)] bg-[color:var(--scl-ink-800)] px-3.5 py-1.5 text-sm shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]",
        className,
      )}
    >
      <Link
        href={`/cappers/${win.handle}`}
        className="font-semibold text-[color:var(--scl-text)] underline decoration-[color:var(--scl-pink)] underline-offset-2 hover:decoration-[color:var(--scl-pink-deep)]"
      >
        @{win.handle}
      </Link>
      <span className="text-muted-foreground" aria-hidden>
        ·
      </span>
      <span className="text-foreground max-w-[12rem] truncate font-medium sm:max-w-[16rem]">
        {win.selection}
      </span>
      <span className="text-muted-foreground" aria-hidden>
        ·
      </span>
      <span className="scl-data text-pos font-semibold">
        {formatWinUnits(profit)}
      </span>
    </span>
  );
}

/** Past-tense graded wins marquee — hidden when empty; pauses on hover/focus. */
export function YesterdayWinsTicker({
  wins,
  label = "Yesterday's Graded Wins",
}: {
  wins: YesterdayGradedWin[];
  label?: "Yesterday's Graded Wins" | "Recent Graded Wins";
}) {
  if (wins.length === 0) return null;

  const staticItems = wins.slice(0, 8);
  const marqueeItems = buildMarqueeItems(wins);
  const halfCount = marqueeItems.length / 2;
  const durationSec = Math.max(28, Math.round(halfCount * 2.8));
  const aria =
    label === "Recent Graded Wins"
      ? "Recent graded wins"
      : "Yesterday's graded wins";

  return (
    <section
      aria-label={aria}
      className="border-border border-b bg-[color:var(--scl-ink-900)]"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-6">
        <p className="scl-eyebrow shrink-0 border-r border-[color:var(--scl-line)] pr-3 text-[color:var(--scl-muted-label)] sm:pr-4">
          {label}
        </p>

        {/* Live marquee — all viewports; hidden under reduced motion */}
        <div
          className={cn(
            "group/ticker relative min-w-0 flex-1 overflow-hidden",
            "motion-reduce:hidden",
            "[mask-image:linear-gradient(to_right,transparent,black_1.25rem,black_calc(100%-1.25rem),transparent)]",
          )}
        >
          <div
            className="scl-ticker-track flex w-max items-center gap-2.5 group-focus-within/ticker:[animation-play-state:paused] group-hover/ticker:[animation-play-state:paused]"
            style={
              {
                animation: `scl-ticker ${durationSec}s linear infinite`,
              } as CSSProperties
            }
            aria-hidden="true"
          >
            {marqueeItems.map((win, i) => (
              <TickerItem key={`dup-${win.id}-${i}`} win={win} />
            ))}
          </div>
          <div className="sr-only">
            {staticItems.map((win) => (
              <span key={win.id}>
                @{win.handle} · {win.selection} ·{" "}
                {formatWinUnits(
                  win.profitUnits > 0 ? win.profitUnits : win.units,
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Reduced motion: compact static row */}
        <ul className="hidden min-w-0 flex-1 flex-wrap items-center gap-2 motion-reduce:flex">
          {staticItems.map((win) => (
            <li key={`static-${win.id}`}>
              <TickerItem win={win} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
