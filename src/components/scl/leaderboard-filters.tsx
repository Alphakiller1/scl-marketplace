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
    LEADERBOARD_SCOPE_WINDOWS.find((w) => w.key === filters.window)?.label ??
    filters.window;

  return (
    <div className="mt-3 space-y-2">
      <details className="border-border bg-card overflow-hidden rounded-[10px] border md:hidden">
        <summary className="focus-visible:ring-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 outline-none focus-visible:ring-2 focus-visible:ring-inset">
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

      <div className="hidden md:block">
        <ScopeForm
          filters={filters}
          action={action}
          className="border-border bg-card rounded-[10px] border px-3 py-2"
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
            className={cn(
              "inline-flex min-h-9 cursor-pointer items-center rounded-[10px] border px-3 text-sm font-semibold tabular-nums transition-colors",
              "border-[color:var(--scl-line)] bg-[color:var(--scl-ink-800)] text-[color:var(--scl-muted-data)]",
              "has-[:checked]:border-[color:var(--scl-blue)] has-[:checked]:bg-[color:var(--scl-blue)] has-[:checked]:text-[color:var(--scl-blue-ink)]",
            )}
          >
            <input
              type="radio"
              name="window"
              value={window.key}
              defaultChecked={filters.window === window.key}
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
            className="border-input bg-surface-2 focus-visible:ring-ring h-9 min-w-[7.5rem] rounded-[10px] border px-2 text-sm outline-none focus-visible:ring-2"
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
          <span className="sr-only">Rank by</span>
          <select
            name="sort"
            defaultValue={filters.sort}
            key={filters.sort}
            onChange={(event) => {
              event.currentTarget.form?.requestSubmit();
            }}
            className="border-input bg-surface-2 focus-visible:ring-ring h-9 min-w-[7rem] rounded-[10px] border px-2 text-sm outline-none focus-visible:ring-2"
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
            className="border-input bg-surface-2 focus-visible:ring-ring h-9 min-w-[6.5rem] rounded-[10px] border px-2 text-sm outline-none focus-visible:ring-2"
          >
            {LEADERBOARD_MIN_PICKS.map((count) => (
              <option key={count} value={String(count)}>
                {count === 0 ? "Any sample" : `${count}+ picks`}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0">
          <span className="sr-only">Record trust</span>
          <select
            name="record"
            defaultValue={filters.verifiedOnly ? "verified" : "all"}
            className="border-input bg-surface-2 focus-visible:ring-ring h-9 min-w-[8rem] rounded-[10px] border px-2 text-sm outline-none focus-visible:ring-2"
          >
            <option value="verified">Verified only</option>
            <option value="all">All records</option>
          </select>
        </label>

        <label className="min-w-0 flex-1 basis-[10rem]">
          <span className="sr-only">Find a capper</span>
          <span className="border-input bg-surface-2 focus-within:ring-ring flex h-9 items-center gap-2 rounded-[10px] border px-2 focus-within:ring-2">
            <Search className="text-muted-foreground size-3.5" aria-hidden />
            <input
              type="search"
              name="q"
              defaultValue={filters.search}
              placeholder="Handle"
              className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </span>
        </label>

        <Button
          type="submit"
          size="sm"
          className="h-9 min-h-11 border-[color:var(--scl-blue)] bg-[color:var(--scl-blue)] text-[color:var(--scl-blue-ink)] hover:bg-[color:var(--scl-blue)]/90 sm:min-h-9"
        >
          Apply
        </Button>
        <Button
          render={<Link href={action} />}
          nativeButton={false}
          variant="outline"
          size="icon"
          className="size-9"
          aria-label="Reset leaderboard scope"
          title="Reset"
        >
          <RotateCcw className="size-3.5" aria-hidden />
        </Button>
      </div>
    </form>
  );
}
