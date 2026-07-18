import Link from "next/link";
import { RotateCcw, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LEADERBOARD_SORTS, SPORTS } from "@/lib/constants";
import {
  LEADERBOARD_MIN_PICKS,
  type LeaderboardFilters as Filters,
} from "@/lib/leaderboard";
import { cn } from "@/lib/utils";

const TIME_SCOPES = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
  { key: "all", label: "All" },
] as const;

function scopeHref(filters: Filters, window: Filters["window"]) {
  const params = new URLSearchParams({
    sport: filters.sport,
    window,
    sort: filters.sort,
    minPicks: String(filters.minPicks),
    record: filters.verifiedOnly ? "verified" : "all",
    limit: String(filters.limit),
  });
  if (filters.search) params.set("q", filters.search);
  return `/leaderboard?${params.toString()}`;
}

export function LeaderboardFilters({
  filters,
  action = "/leaderboard",
}: {
  filters: Filters;
  action?: string;
  label?: string;
}) {
  return (
    <section
      aria-label="Leaderboard scope"
      className="border-border bg-card mt-5 rounded-[var(--scl-radius-card)] border p-2 sm:mt-6"
    >
      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-end">
        <fieldset className="shrink-0">
          <legend className="text-muted-foreground flex items-center gap-1.5 text-[0.65rem] font-semibold tracking-wide uppercase">
            <SlidersHorizontal className="size-3.5" aria-hidden />
            Time scope
          </legend>
          <div className="mt-1.5 grid grid-cols-4 gap-1">
            {TIME_SCOPES.map((scope) => {
              const active = filters.window === scope.key;
              return (
                <Link
                  key={scope.key}
                  href={scopeHref(filters, scope.key)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-ring inline-flex min-h-11 min-w-12 items-center justify-center rounded-lg border px-2 text-sm font-semibold tabular-nums outline-none focus-visible:ring-2",
                    active
                      ? "border-[color:var(--scl-blue)] bg-[color:var(--scl-blue)] text-[color:var(--scl-blue-ink)]"
                      : "border-border bg-surface-2 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {scope.label}
                </Link>
              );
            })}
          </div>
        </fieldset>

        <form
          method="get"
          action={action}
          className="grid min-w-0 flex-1 grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto_auto]"
        >
          <input type="hidden" name="window" value={filters.window} />
          <input type="hidden" name="limit" value={filters.limit} />
          {filters.search ? (
            <input type="hidden" name="q" value={filters.search} />
          ) : null}
          <CompactSelect
            label="Sport"
            name="sport"
            defaultValue={filters.sport}
          >
            <option value="ALL">All sports</option>
            {SPORTS.map((sport) => (
              <option key={sport.key} value={sport.key}>
                {sport.label}
              </option>
            ))}
          </CompactSelect>
          <CompactSelect
            label="Rank by"
            name="sort"
            defaultValue={filters.sort}
          >
            {LEADERBOARD_SORTS.map((sort) => (
              <option key={sort.key} value={sort.key}>
                {sort.label}
              </option>
            ))}
          </CompactSelect>
          <CompactSelect
            label="Minimum sample"
            name="minPicks"
            defaultValue={String(filters.minPicks)}
          >
            {LEADERBOARD_MIN_PICKS.map((count) => (
              <option key={count} value={count}>
                {count === 0 ? "Any graded sample" : `${count}+ graded picks`}
              </option>
            ))}
          </CompactSelect>
          <label className="border-border bg-surface-2 flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-sm font-semibold">
            <input type="hidden" name="record" value="all" />
            <input
              type="checkbox"
              name="record"
              value="verified"
              defaultChecked={filters.verifiedOnly}
              className="size-4 accent-[color:var(--scl-pink)]"
            />
            Verified only
          </label>
          <div className="col-span-2 flex gap-2 sm:col-span-1">
            <Button
              type="submit"
              className="flex-1 bg-[color:var(--scl-blue)] text-[color:var(--scl-blue-ink)] hover:bg-[color:var(--scl-blue-deep)] sm:flex-none"
            >
              Apply
            </Button>
            <Button
              render={<Link href={action} />}
              nativeButton={false}
              variant="outline"
              size="icon"
              aria-label="Reset leaderboard scope"
              title="Reset scope"
            >
              <RotateCcw className="size-4" aria-hidden />
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}

function CompactSelect({
  label,
  name,
  defaultValue,
  className,
  children,
}: {
  label: string;
  name: string;
  defaultValue: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("min-w-0", className)}>
      <span className="text-muted-foreground block text-[0.65rem] font-semibold tracking-wide uppercase">
        {label}
      </span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="border-border bg-surface-2 focus-visible:ring-ring mt-1.5 min-h-11 w-full rounded-lg border px-2.5 text-sm font-semibold outline-none focus-visible:ring-2"
      >
        {children}
      </select>
    </label>
  );
}
