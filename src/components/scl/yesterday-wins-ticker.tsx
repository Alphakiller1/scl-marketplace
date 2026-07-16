"use client";

import Link from "next/link";

import type { YesterdayGradedWin } from "@/lib/queries/yesterday-wins";
import { cn } from "@/lib/utils";

function formatWinUnits(units: number): string {
  const rounded = Math.round(units * 100) / 100;
  const text = rounded.toFixed(2).replace(/\.00$/, "");
  return `+${text}U`;
}

function TickerItem({ win }: { win: YesterdayGradedWin }) {
  const profit = win.profitUnits > 0 ? win.profitUnits : win.units;
  return (
    <span className="inline-flex shrink-0 items-center gap-2 px-4 text-sm">
      <Link
        href={`/cappers/${win.handle}`}
        className="font-semibold text-[color:var(--scl-pink)] hover:underline"
      >
        @{win.handle}
      </Link>
      <span className="text-muted-foreground" aria-hidden>
        ·
      </span>
      <span className="text-foreground max-w-[14rem] truncate font-medium">
        {win.selection}
      </span>
      <span className="text-muted-foreground" aria-hidden>
        ·
      </span>
      <span className="text-pos font-semibold tabular-nums">
        {formatWinUnits(profit)}
      </span>
    </span>
  );
}

/** Past-tense graded wins marquee — hidden when empty; pauses on hover/focus. */
export function YesterdayWinsTicker({ wins }: { wins: YesterdayGradedWin[] }) {
  if (wins.length === 0) return null;

  const staticItems = wins.slice(0, 8);
  const marqueeItems = wins.length > 1 ? [...wins, ...wins] : wins;

  return (
    <section
      aria-label="Yesterday's graded wins"
      className="border-border border-b bg-[color:var(--scl-ink-900)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
        <p className="scl-eyebrow mb-2 text-[color:var(--scl-muted-label)]">
          Yesterday&apos;s Graded Wins
        </p>

        <ul className="hidden gap-2 md:flex md:flex-col">
          {staticItems.map((win) => (
            <li key={win.id}>
              <TickerItem win={win} />
            </li>
          ))}
        </ul>

        <div
          className={cn(
            "group/ticker relative overflow-hidden md:hidden",
            "max-md:motion-reduce:hidden",
          )}
        >
          <div
            className="flex w-max animate-[scl-ticker_40s_linear_infinite] group-focus-within/ticker:[animation-play-state:paused] group-hover/ticker:[animation-play-state:paused]"
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
                {formatWinUnits(win.profitUnits)}
              </span>
            ))}
          </div>
        </div>

        <ul className="flex flex-col gap-2 max-md:motion-reduce:flex md:hidden">
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
