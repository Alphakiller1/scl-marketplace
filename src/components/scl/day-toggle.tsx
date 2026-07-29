"use client";

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { slateDateLabel, type SlateDay } from "@/lib/slate";

/** Today / Tomorrow slate switch — SEGMENTED CONTROL recipe (blue = navigation). */
export function DayToggle({
  day,
  todayCount,
  tomorrowCount,
  loading,
  onChange,
}: {
  day: SlateDay;
  todayCount: number;
  tomorrowCount: number;
  loading?: boolean;
  onChange: (day: SlateDay) => void;
}) {
  const counts: Record<SlateDay, number> = {
    today: todayCount,
    tomorrow: tomorrowCount,
  };
  const now = new Date();
  const dateLabel: Record<SlateDay, string> = {
    today: slateDateLabel("today", now),
    tomorrow: slateDateLabel("tomorrow", now),
  };

  return (
    <div className="grid grid-cols-2 gap-[3px] rounded-[10px] border border-[color:var(--scl-line)] bg-[color:var(--scl-ink-800)] p-[3px]">
      {(["today", "tomorrow"] as const).map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          disabled={loading}
          aria-pressed={day === d}
          className={cn(
            "scl-display relative min-h-10 rounded-lg text-sm font-semibold tracking-[0.06em] uppercase transition-colors",
            day === d
              ? "bg-[color:var(--scl-blue)] text-[color:var(--scl-blue-ink)] shadow-[inset_0_0_0_1px_var(--scl-blue-deep)]"
              : "text-[color:var(--scl-muted-data)] hover:text-[color:var(--scl-text)]",
            loading && "opacity-60",
          )}
        >
          {d}
          <span
            className={cn(
              "scl-data mt-0.5 block text-[0.65rem] font-medium tracking-[0.08em] normal-case",
              day === d
                ? "text-[color:var(--scl-blue-ink)]/80"
                : "text-[color:var(--scl-muted-data)]",
            )}
          >
            {dateLabel[d]}
            {loading ? "" : ` · ${counts[d]}`}
          </span>
          {loading && d === day ? (
            <Loader2
              className="absolute top-2 right-2 size-3.5 animate-spin text-[color:var(--scl-muted-data)]"
              aria-hidden
            />
          ) : null}
        </button>
      ))}
    </div>
  );
}
