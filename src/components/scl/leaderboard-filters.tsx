import Link from "next/link";
import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SPORTS, LEADERBOARD_SORTS } from "@/lib/constants";
import {
  LEADERBOARD_MIN_PICKS,
  LEADERBOARD_WINDOWS,
  type LeaderboardFilters as Filters,
} from "@/lib/leaderboard";

export function LeaderboardFilters({
  filters,
  action = "/leaderboard",
  label = "Ranking scope",
}: {
  filters: Filters;
  action?: string;
  label?: string;
}) {
  return (
    <form
      method="get"
      action={action}
      aria-label="Leaderboard filters"
      className="border-border bg-card mt-6 rounded-xl border p-3"
    >
      <div className="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-semibold uppercase">
        <SlidersHorizontal className="text-brand size-4" aria-hidden />
        {label}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_1.4fr_auto_auto]">
        <FilterSelect label="Sport" name="sport" defaultValue={filters.sport}>
          <option value="ALL">All sports</option>
          {SPORTS.map((sport) => (
            <option key={sport.key} value={sport.key}>
              {sport.label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Window"
          name="window"
          defaultValue={filters.window}
        >
          {LEADERBOARD_WINDOWS.map((window) => (
            <option key={window.key} value={window.key}>
              {window.label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Rank by" name="sort" defaultValue={filters.sort}>
          {LEADERBOARD_SORTS.map((sort) => (
            <option key={sort.key} value={sort.key}>
              {sort.label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Minimum sample"
          name="minPicks"
          defaultValue={String(filters.minPicks)}
        >
          {LEADERBOARD_MIN_PICKS.map((count) => (
            <option key={count} value={count}>
              {count === 0 ? "Any sample" : `${count}+ picks`}
            </option>
          ))}
        </FilterSelect>
        <label className="min-w-0">
          <span className="text-muted-foreground block text-[0.7rem] font-semibold uppercase">
            Find a capper
          </span>
          <span className="border-input bg-surface-2 focus-within:ring-ring mt-1 flex min-h-10 items-center gap-2 rounded-lg border px-3 focus-within:ring-2">
            <Search className="text-muted-foreground size-4" aria-hidden />
            <input
              type="search"
              name="q"
              defaultValue={filters.search}
              placeholder="Name or handle"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </span>
        </label>
        <FilterSelect
          label="Record"
          name="record"
          defaultValue={filters.verifiedOnly ? "verified" : "all"}
        >
          <option value="verified">Verified only</option>
          <option value="all">All records</option>
        </FilterSelect>
        <div className="flex items-end gap-2">
          <Button type="submit" className="min-h-10 flex-1 lg:flex-none">
            Apply
          </Button>
          <Button
            render={<Link href={action} />}
            nativeButton={false}
            variant="outline"
            size="icon"
            className="size-10"
            aria-label="Reset leaderboard filters"
            title="Reset filters"
          >
            <RotateCcw className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </form>
  );
}

function FilterSelect({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <label className="min-w-0">
      <span className="text-muted-foreground block text-[0.7rem] font-semibold uppercase">
        {label}
      </span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="border-input bg-surface-2 focus:ring-ring mt-1 min-h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2"
      >
        {children}
      </select>
    </label>
  );
}
