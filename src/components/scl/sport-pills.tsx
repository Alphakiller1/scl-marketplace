"use client";

import { cn } from "@/lib/utils";
import { SPORTS } from "@/lib/constants";

/**
 * Premium sport selector — a pill row instead of a native <select>. Controlled: `value` is the
 * active SCL sport key, `onChange` fires on tap. Wraps (no horizontal overflow) and every pill is
 * a ≥40px tap target.
 */
export function SportPills({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (sport: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {SPORTS.map((s) => {
        const active = value === s.key;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onChange(s.key)}
            aria-pressed={active}
            className={cn(
              "min-h-10 rounded-full border px-3.5 text-sm font-semibold transition-colors",
              active
                ? "border-brand bg-brand/10 text-brand"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
            )}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
