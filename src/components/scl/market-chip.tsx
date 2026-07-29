"use client";

import { Check } from "lucide-react";

import { BettingTitle } from "@/components/scl/betting-title";
import { BookMark } from "@/components/scl/book-mark";
import { PlayerHeadshot } from "@/components/scl/player-headshot";
import { bookShort } from "@/lib/books";
import { cn } from "@/lib/utils";
import { formatCaptureClock, formatOdds } from "@/lib/format";
import { isExtremeAmericanOdds } from "@/lib/odds-board";
import {
  resolvePlayerHeadshot,
  type HeadshotLeague,
} from "@/lib/player-headshots";

/**
 * v2 odds chip — single row: label + odds.
 * SELECTED = pink fill, pink-ink, ring + ✓ prefix.
 * Missing odds → honest em-dash, not pickable.
 * Extreme American prices (≥+900 / ≤−2000) get a quiet review mark + source context.
 */
export function MarketChip({
  label,
  oddsAmerican,
  book,
  oddsCapturedAt,
  league,
  selected,
  disabled,
  onClick,
  className,
}: {
  label: string;
  /** American price, or null when the active book has no line. */
  oddsAmerican: number | null;
  /** Odds API bookmaker key — shown as a mono short tag when present. */
  book?: string;
  /** Bookmaker last_update ISO — shown inline when the price is extreme. */
  oddsCapturedAt?: string;
  /** Player-prop league hint so a named player shows a real headshot. */
  league?: HeadshotLeague;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const missing = oddsAmerican === null;
  const propPlayer = resolvePlayerHeadshot(label, league);
  const extreme =
    !missing && typeof oddsAmerican === "number"
      ? isExtremeAmericanOdds(oddsAmerican)
      : false;
  const bookTag = book && !missing ? bookShort(book) : null;
  const captureLabel =
    extreme && oddsCapturedAt ? formatCaptureClock(oddsCapturedAt) : null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || selected || missing}
      aria-pressed={selected}
      title={
        extreme
          ? "Extreme price — flagged for operator review (still selectable)"
          : undefined
      }
      className={cn(
        "group flex min-h-[3.25rem] w-full items-center justify-between gap-2 rounded-[var(--scl-radius-chip)] border px-3.5 py-2 text-left transition-all duration-150 ease-out active:translate-y-px",
        selected
          ? "scl-fill-brand cursor-default shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--scl-pink-ink)_55%,transparent)]"
          : "border-[color:var(--scl-line)] bg-[color:var(--scl-ink-700)] hover:border-[color:var(--scl-blue)] hover:bg-[color:var(--scl-ink-600)] hover:shadow-[var(--scl-shadow-card)]",
        missing &&
          "cursor-default opacity-55 hover:border-[color:var(--scl-line)] hover:bg-[color:var(--scl-ink-700)] hover:shadow-none",
        className,
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          {propPlayer ? (
            <PlayerHeadshot
              selection={label}
              league={league}
              size={22}
              className="shrink-0"
            />
          ) : null}
          <BettingTitle
            text={label}
            className={cn(
              "min-w-0 truncate text-sm font-medium",
              selected
                ? "font-semibold text-[color:var(--scl-pink-ink)]"
                : "text-[color:var(--scl-muted-data)]",
            )}
          />
          {bookTag ? (
            <span
              className={cn(
                "scl-data inline-flex shrink-0 items-center gap-0.5 text-[0.56rem] font-medium tracking-[0.08em] uppercase",
                selected
                  ? "text-[color:var(--scl-pink-ink)]/80"
                  : "text-[color:var(--scl-muted-data)]",
              )}
            >
              {book ? <BookMark bookKey={book} size={16} /> : null}
              {bookTag}
            </span>
          ) : null}
        </span>
        {extreme ? (
          <span
            className={cn(
              "scl-data text-[0.56rem] tracking-[0.1em] uppercase",
              selected
                ? "text-[color:var(--scl-pink-ink)]/75"
                : "text-[color:var(--scl-muted-label)]",
            )}
          >
            Review
            {bookTag ? ` · ${bookTag}` : ""}
            {captureLabel ? ` · ${captureLabel}` : ""}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "scl-data flex shrink-0 items-center gap-1 text-[0.95rem] leading-none font-bold tabular-nums",
          selected
            ? "text-[color:var(--scl-pink-ink)]"
            : missing
              ? "text-[color:var(--scl-muted-label)]"
              : "text-[color:var(--scl-text)]",
        )}
      >
        {selected ? <Check className="size-3.5 shrink-0" aria-hidden /> : null}
        {missing ? "—" : formatOdds(oddsAmerican)}
      </span>
    </button>
  );
}
