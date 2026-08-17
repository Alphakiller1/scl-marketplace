"use client";

import Link from "next/link";
import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";

import { LeagueMark } from "@/components/scl/league-mark";
import { Button } from "@/components/ui/button";
import { SPORTS, LEADERBOARD_SORTS } from "@/lib/constants";
import {
  LEADERBOARD_MIN_PICKS,
  LEADERBOARD_SCOPE_WINDOWS,
  type LeaderboardFilters as Filters,
} from "@/lib/leaderboard";
import { cn } from "@/lib/utils";

// Shared control look: tighter height (40px mobile tap target → 36px desktop),
// crisper radius, and a subtle top-highlight sheen + soft depth so the bar reads
// sharp instead of chunky/flat.
const FIELD_CLASS =
  "border-input bg-surface-2 focus-visible:ring-ring h-10 rounded-[9px] border px-2.5 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_1.5px_rgba(0,0,0,0.28)] outline-none transition-colors focus-visible:ring-2 lg:h-9 lg:text-sm";

/**
 * Compact Rank-mode scope bar — never taller than the results.
 * Time scope uses blue active segments (navigation).
 */
export function LeaderboardFilters({
  filters,
  action = "/leaderboard",
}: {
  filters: Filters;
  action?: string;
}) {
  const sportLabel =
    filters.sport === "ALL"
      ? "All sports"
      : (SPORTS.find((sport) => sport.key === filters.sport)?.label ??
        filters.sport);
  const windowLabel =
    LEADERBOARD_SCOPE_WINDOWS.find((w) => w.key === filters.window)
      ?.longLabel ?? filters.window;

  return (
    <div className="mt-3 space-y-2">
      <details className="border-border scl-elevated overflow-hidden rounded-[10px] border lg:hidden">
        <summary className="focus-visible:ring-ring flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 outline-none focus-visible:ring-2 focus-visible:ring-inset">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal
              className="size-3.5 text-[color:var(--scl-muted-label)]"
              aria-hidden
            />
            Scope
          </span>
          <span className="text-muted-foreground inline-flex min-w-0 items-center gap-1.5 truncate text-xs">
            {filters.sport !== "ALL" ? (
              <LeagueMark
                leagueKey={filters.sport}
                size="sm"
                className="rounded-md"
              />
            ) : null}
            {sportLabel} · {windowLabel}
          </span>
        </summary>
        <ScopeForm
          filters={filters}
          action={action}
          className="border-border border-t p-3"
        />
      </details>

      <div className="hidden lg:block">
        <ScopeForm
          filters={filters}
          action={action}
          className="border-border scl-elevated rounded-[10px] border px-2.5 py-1.5"
        />
      </div>
    </div>
  );
}

function ScopeForm({
  filters,
  action,
  className,
}: {
  filters: Filters;
  action: string;
  className?: string;
}) {
  return (
    <form
      method="get"
      action={action}
      aria-label="Leaderboard scope"
      className={cn("flex flex-col gap-2", className)}
    >
      {filters.limit !== 10 ? (
        <input type="hidden" name="limit" value={filters.limit} />
      ) : null}

      <div
        className="flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="Time scope"
      >
        {LEADERBOARD_SCOPE_WINDOWS.map((window) => (
          <label
            key={window.key}
            title={window.longLabel}
            className={cn(
              "inline-flex min-h-10 cursor-pointer items-center rounded-full border px-3 text-xs leading-none font-semibold tabular-nums transition-colors lg:h-8 lg:min-h-0",
              "border-[color:var(--scl-line)] bg-[color:var(--scl-ink-800)] text-[color:var(--scl-muted-data)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:text-[color:var(--scl-text)]",
              "has-[:checked]:border-[color:var(--scl-blue)] has-[:checked]:bg-[color:var(--scl-blue)] has-[:checked]:text-[color:var(--scl-blue-ink)] has-[:checked]:shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]",
            )}
          >
            <input
              type="radio"
              name="window"
              value={window.key}
              defaultChecked={filters.window === window.key}
              aria-label={`${window.label}, ${window.longLabel}`}
              className="sr-only"
            />
            {window.label}
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0">
          <span className="sr-only">Sport</span>
          <select
            name="sport"
            defaultValue={filters.sport}
            className={cn(FIELD_CLASS, "min-w-[7.5rem]")}
          >
            <option value="ALL">All sports</option>
            {SPORTS.map((sport) => (
              <option key={sport.key} value={sport.key}>
                {sport.label}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0">
          <span className="sr-only">Sort direction</span>
          <select
            name="dir"
            defaultValue={filters.direction ?? "desc"}
            className={cn(FIELD_CLASS, "min-w-[8rem]")}
          >
            <option value="desc">High to low</option>
            <option value="asc">Low to high</option>
          </select>
        </label>

        <label className="min-w-0">
          <span className="sr-only">Rank by</span>
          <select
            name="sort"
            defaultValue={filters.sort}
            key={filters.sort}
            onChange={(event) => {
              event.currentTarget.form?.requestSubmit();
            }}
            className={cn(FIELD_CLASS, "min-w-[7rem]")}
          >
            {LEADERBOARD_SORTS.map((sort) => (
              <option key={sort.key} value={sort.key}>
                {sort.label}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0">
          <span className="sr-only">Minimum sample</span>
          <select
            name="minPicks"
            defaultValue={String(filters.minPicks)}
            className={cn(FIELD_CLASS, "min-w-[6.5rem]")}
          >
            {LEADERBOARD_MIN_PICKS.map((count) => (
              <option key={count} value={String(count)}>
                {count === 0 ? "Any sample" : `${count}+ picks`}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0 flex-1 basis-[10rem]">
          <span className="sr-only">Find a capper</span>
          <span className="border-input bg-surface-2 focus-within:ring-ring flex h-10 items-center gap-2 rounded-[9px] border px-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_1.5px_rgba(0,0,0,0.28)] focus-within:ring-2 lg:h-9">
            <Search className="text-muted-foreground size-3.5" aria-hidden />
            <input
              type="search"
              name="q"
              defaultValue={filters.search}
              placeholder="Search cappers"
              className="h-full min-w-0 flex-1 bg-transparent text-base outline-none lg:text-sm"
            />
          </span>
        </label>

        <Button
          type="submit"
          size="sm"
          className="h-10 min-h-0 rounded-[9px] border-[color:var(--scl-blue)] bg-[color:var(--scl-blue)] text-[color:var(--scl-blue-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] hover:bg-[color:var(--scl-blue)]/90 lg:h-9"
        >
          Apply
        </Button>
        <Button
          render={<Link href={action} />}
          nativeButton={false}
          variant="outline"
          size="icon"
          className="size-10 rounded-[9px] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_1.5px_rgba(0,0,0,0.28)] lg:size-9"
          aria-label="Reset leaderboard scope"
          title="Reset"
        >
          <RotateCcw className="size-3.5" aria-hidden />
        </Button>
      </div>
    </form>
  );
}
