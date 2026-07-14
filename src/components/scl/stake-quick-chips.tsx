"use client";

import { UNIT_QUICK_CHIPS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Stake quick-chips (0.5 / 1 / 2 / 3u) beside the units input.
 * Parent owns value + to-win recompute via setValue / controlled state.
 */
export function StakeQuickChips({
  value,
  onChange,
  className,
}: {
  value?: number | null;
  onChange: (units: number) => void;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-wrap gap-1.5", className)}
      role="group"
      aria-label="Quick stake"
    >
      {UNIT_QUICK_CHIPS.map((u) => {
        const active = value === u;
        return (
          <button
            key={u}
            type="button"
            onClick={() => onChange(u)}
            aria-pressed={active}
            className={cn(
              "scl-data min-h-10 min-w-10 rounded-full border px-3 text-sm font-semibold tabular-nums transition-colors",
              active
                ? "border-pink bg-pink text-pink-foreground"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
            )}
          >
            {u}u
          </button>
        );
      })}
    </div>
  );
}
