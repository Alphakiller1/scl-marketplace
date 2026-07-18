"use client";

import { BettingTitle } from "@/components/scl/betting-title";
import { BookMark } from "@/components/scl/book-mark";
import { bookShort } from "@/lib/books";
import { cn } from "@/lib/utils";
import { formatOdds } from "@/lib/format";

/**
 * v2 odds chip — single row: label + odds.
 * SELECTED = pink fill, pink-ink, ring + ✓ prefix.
 * Missing odds → honest em-dash, not pickable.
 */
export function MarketChip({
  label,
  oddsAmerican,
  book,
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
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const missing = oddsAmerican === null;
  const bookTag = book && !missing ? bookShort(book) : null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || selected || missing}
      aria-pressed={selected}
      className={cn(
        "flex min-h-12 w-full items-center justify-between gap-2 rounded-[var(--scl-radius-chip)] border px-3 py-2 text-left transition-[background-color,box-shadow,border-color] duration-150 ease-in-out",
        selected
          ? "cursor-default border-[color:var(--scl-pink)] bg-[color:var(--scl-pink)] text-[color:var(--scl-pink-ink)] shadow-[0_0_0_2px_var(--scl-ink-950),0_0_0_3.5px_var(--scl-pink-deep)]"
          : "border-[color:var(--scl-line)] bg-[color:var(--scl-ink-700)] hover:bg-[color:var(--scl-ink-600)]",
        missing &&
          "cursor-default opacity-60 hover:bg-[color:var(--scl-ink-700)]",
        className,
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
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
      <span
        className={cn(
          "scl-data shrink-0 text-sm font-semibold tabular-nums",
          selected
            ? "text-[color:var(--scl-pink-ink)]"
            : "text-[color:var(--scl-text)]",
        )}
      >
        {selected ? "✓ " : ""}
        {missing ? "—" : formatOdds(oddsAmerican)}
      </span>
    </button>
  );
}
