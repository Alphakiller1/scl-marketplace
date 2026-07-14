import Link from "next/link";
import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SPORTS, LEADERBOARD_SORTS } from "@/lib/constants";
import {
  LEADERBOARD_MIN_PICKS,
  LEADERBOARD_WINDOWS,
  type LeaderboardFilters as Filters,
} from "@/lib/leaderboard";
import { cn } from "@/lib/utils";

export function LeaderboardFilters({
  filters,
  action = "/leaderboard",
  label = "Ranking Scope",
}: {
  filters: Filters;
  action?: string;
  label?: string;
}) {
  const sportLabel =
    filters.sport === "ALL"
      ? "All Sports"
      : (SPORTS.find((sport) => sport.key === filters.sport)?.label ??
        filters.sport);
  const windowLabel =
    LEADERBOARD_WINDOWS.find((window) => window.key === filters.window)
      ?.label ?? filters.window;

  return (
    <>
      <details className="border-border bg-card mt-5 overflow-hidden rounded-xl border md:hidden">
        <summary className="focus-visible:ring-ring flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 outline-none focus-visible:ring-2 focus-visible:ring-inset">
          <span className="flex items-center gap-2 font-semibold">
            <SlidersHorizontal
              className="size-4 text-[color:var(--scl-muted-label)]"
              aria-hidden
            />
            Filter Rankings
          </span>
          <span className="text-muted-foreground truncate text-xs">
            {sportLabel} · {windowLabel}
          </span>
        </summary>
        <FilterForm
          filters={filters}
          action={action}
          className="border-border border-t p-4"
        />
      </details>

      <div className="hidden md:block">
        <FilterForm
          filters={filters}
          action={action}
          label={label}
          className="border-border bg-card mt-6 rounded-xl border p-3"
        />
      </div>
    </>
  );
}

function FilterForm({
  filters,
  action,
  label,
  className,
}: {
  filters: Filters;
  action: string;
  label?: string;
  className?: string;
}) {
  return (
    <form
      method="get"
      action={action}
      aria-label="Leaderboard Filters"
      className={className}
    >
      {label ? (
        <div className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-semibold uppercase">
          <SlidersHorizontal
            className="size-4 text-[color:var(--scl-muted-label)]"
            aria-hidden
          />
          {label}
        </div>
      ) : null}
      <div className="grid gap-4">
        <FilterPillGroup
          label="Sport"
          name="sport"
          value={filters.sport}
          options={[
            { value: "ALL", label: "All Sports" },
            ...SPORTS.map((sport) => ({
              value: sport.key,
              label: sport.label,
            })),
          ]}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <FilterPillGroup
            label="Window"
            name="window"
            value={filters.window}
            options={LEADERBOARD_WINDOWS.map((window) => ({
              value: window.key,
              label: window.label,
            }))}
          />
          <FilterPillGroup
            label="Rank By"
            name="sort"
            value={filters.sort}
            options={LEADERBOARD_SORTS.map((sort) => ({
              value: sort.key,
              label: sort.label,
            }))}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <FilterPillGroup
            label="Minimum Sample"
            name="minPicks"
            value={String(filters.minPicks)}
            options={LEADERBOARD_MIN_PICKS.map((count) => ({
              value: String(count),
              label: count === 0 ? "Any Sample" : `${count}+ Picks`,
            }))}
          />
          <FilterPillGroup
            label="Record"
            name="record"
            value={filters.verifiedOnly ? "verified" : "all"}
            options={[
              { value: "verified", label: "Verified Only" },
              { value: "all", label: "All Records" },
            ]}
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1">
            <span className="text-muted-foreground block text-[0.7rem] font-semibold uppercase">
              Find A Capper
            </span>
            <span className="border-input bg-surface-2 focus-within:ring-ring mt-1 flex min-h-11 items-center gap-2 rounded-lg border px-3 focus-within:ring-2">
              <Search className="text-muted-foreground size-4" aria-hidden />
              <input
                type="search"
                name="q"
                defaultValue={filters.search}
                placeholder="Name Or Handle"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </span>
          </label>
          <div className="flex items-end gap-2">
            <Button
              type="submit"
              className="min-h-11 flex-1 border-[color:var(--scl-gold)] bg-[color:var(--scl-gold)] text-[color:var(--scl-gold-ink)] hover:bg-[color:var(--scl-gold-deep)] hover:text-[color:var(--scl-gold-ink)] sm:flex-none"
            >
              Apply
            </Button>
            <Button
              render={<Link href={action} />}
              nativeButton={false}
              variant="outline"
              size="icon"
              className="size-11"
              aria-label="Reset Leaderboard Filters"
              title="Reset Filters"
            >
              <RotateCcw className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

/** Radio pill row — same visual language as SportPills, keeps URL GET forms. */
function FilterPillGroup({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-muted-foreground text-[0.7rem] font-semibold uppercase">
        {label}
      </legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "scl-display inline-flex min-h-11 cursor-pointer items-center rounded-[22px] border px-3.5 text-[15px] font-semibold tracking-[0.05em] transition-colors",
              "border-[color:var(--scl-line)] bg-[color:var(--scl-ink-800)] text-[color:var(--scl-muted-data)]",
              "has-[:checked]:border-[color:var(--scl-gold)] has-[:checked]:bg-[color:var(--scl-gold)] has-[:checked]:text-[color:var(--scl-gold-ink)]",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={value === option.value}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
