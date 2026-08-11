"use client";

import { UNIT_QUICK_CHIPS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Owner-approved 1 / 2 / 3 / 4 / 5-unit quick chips beside the stake input.
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
              "scl-data min-h-10 min-w-10 rounded-[var(--scl-radius-chip)] border px-2.5 text-xs leading-none font-semibold tabular-nums transition-colors",
              active
                ? "scl-fill-brand"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            {u}U
          </button>
        );
      })}
    </div>
  );
}
