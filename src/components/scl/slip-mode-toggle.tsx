"use client";

import { cn } from "@/lib/utils";
import type { SlipMode } from "@/lib/slip";

/**
 * In-slip Singles | Parlay segmented control — blue = navigation (v1.1).
 * Supersedes the #113 EntryModeCards routing pattern (M5 §2.1).
 */
export function SlipModeToggle({
  mode,
  onChange,
  className,
}: {
  mode: SlipMode;
  onChange: (mode: SlipMode) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Slip mode"
      className={cn(
        "grid grid-cols-2 gap-1 rounded-[12px] border border-[color:var(--scl-line)] bg-[color:var(--scl-ink-800)] p-1",
        className,
      )}
    >
      {(["singles", "parlay"] as const).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(m)}
            className={cn(
              "scl-display min-h-11 rounded-[10px] px-3 text-sm font-semibold tracking-[0.06em] uppercase transition-colors",
              active
                ? "bg-[color:var(--scl-blue)] text-[color:var(--scl-blue-ink)]"
                : "text-[color:var(--scl-text)] hover:bg-[color:var(--scl-ink-700)]",
            )}
          >
            {m === "singles" ? "Singles" : "Parlay"}
          </button>
        );
      })}
    </div>
  );
}
