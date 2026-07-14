"use client";

import { BettingTitle } from "@/components/scl/betting-title";
import { cn } from "@/lib/utils";
import { formatOdds } from "@/lib/format";

/**
 * Odds market chip — SCL-DESIGN-SPEC CHIP recipe.
 * Selected: gold fill + gold-ink + "✓ " odds prefix + double ring.
 */
export function MarketChip({
  label,
  oddsAmerican,
  selected,
  disabled,
  onClick,
  className,
}: {
  label: string;
  oddsAmerican: number;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || selected}
      aria-pressed={selected}
      className={cn(
        "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[var(--scl-radius-chip)] border px-2 py-1.5 text-center transition-[background-color,box-shadow,border-color] duration-150 ease-in-out",
        selected
          ? "cursor-default border-[color:var(--scl-pink)] bg-[color:var(--scl-pink)] text-[color:var(--scl-pink-ink)] shadow-[0_0_0_2px_var(--scl-ink-950),0_0_0_3.5px_var(--scl-pink-deep)]"
          : "border-[color:var(--scl-line)] bg-[color:var(--scl-ink-700)] hover:bg-[color:var(--scl-ink-600)]",
        className,
      )}
    >
      <BettingTitle
        text={label}
        className={cn(
          "min-w-0 truncate text-xs font-medium",
          selected
            ? "font-semibold text-[color:var(--scl-pink-ink)]"
            : "text-[color:var(--scl-muted-data)]",
        )}
      />
      <span
        className={cn(
          "scl-data text-sm font-semibold tabular-nums",
          selected
            ? "text-[color:var(--scl-pink-ink)]"
            : "text-[color:var(--scl-text)]",
        )}
      >
        {selected ? "✓ " : ""}
        {formatOdds(oddsAmerican)}
      </span>
    </button>
  );
}
