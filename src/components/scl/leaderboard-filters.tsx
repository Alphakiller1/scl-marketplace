import Link from "next/link";
import {
  CalendarDays,
  ChartPie,
  ChevronDown,
  Globe2,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { LeagueMark } from "@/components/scl/league-mark";
import { Button } from "@/components/ui/button";
import { LEADERBOARD_SORTS, SPORTS } from "@/lib/constants";
import {
  LEADERBOARD_MIN_PICKS,
  LEADERBOARD_SCOPE_WINDOWS,
  leaderboardHref,
  type LeaderboardFilters as Filters,
} from "@/lib/leaderboard";
import { cn } from "@/lib/utils";

/** Compact Rank-mode scope bar. The board remains the dominant surface. */
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
    LEADERBOARD_SCOPE_WINDOWS.find((window) => window.key === filters.window)
      ?.longLabel ?? filters.window;
  const sortLabel =
    LEADERBOARD_SORTS.find((sort) => sort.key === filters.sort)?.label ??
    filters.sort;

  return (
    <div className="mt-4">
      <details className="border-border bg-card overflow-hidden rounded-[10px] border lg:hidden">
        <summary className="focus-visible:ring-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 outline-none focus-visible:ring-2 focus-visible:ring-inset">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal
              className="size-3.5 text-[color:var(--scl-muted-label)]"
              aria-hidden
            />
            Ranking scope
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
        <MobileScopeForm
          filters={filters}
          action={action}
          className="border-border border-t p-3"
        />
      </details>

      <DesktopScopeForm
        filters={filters}
        action={action}
        sportLabel={sportLabel}
        windowLabel={windowLabel}
        sortLabel={sortLabel}
      />
    </div>
  );
}

function DesktopScopeForm({
  filters,
  action,
  sportLabel,
  windowLabel,
  sortLabel,
}: {
  filters: Filters;
  action: string;
  sportLabel: string;
  windowLabel: string;
  sortLabel: string;
}) {
  return (
    <form
      method="get"
      action={action}
      aria-label="Leaderboard scope"
      className="hidden lg:block"
    >
      {filters.limit !== 10 ? (
        <input type="hidden" name="limit" value={filters.limit} />
      ) : null}

      <div className="border-border bg-card flex items-center gap-3 rounded-[10px] border p-2.5">
        <p className="scl-eyebrow hidden shrink-0 px-2 text-[color:var(--scl-muted-data)] xl:block">
          Ranking scope
        </p>
        <div className="grid min-w-0 flex-1 grid-cols-4 overflow-hidden rounded-[8px] border border-[color:var(--scl-line)]">
          <ScopeSelect icon={Globe2} label="Sport">
            <select name="sport" defaultValue={filters.sport}>
              <option value="ALL">All sports</option>
              {SPORTS.map((sport) => (
                <option key={sport.key} value={sport.key}>
                  {sport.label}
                </option>
              ))}
            </select>
          </ScopeSelect>

          <ScopeSelect icon={CalendarDays} label="Time scope">
            <select name="window" defaultValue={filters.window}>
              {LEADERBOARD_SCOPE_WINDOWS.map((window) => (
                <option key={window.key} value={window.key}>
                  {window.longLabel}
                </option>
              ))}
            </select>
          </ScopeSelect>

          <ScopeSelect icon={ChartPie} label="Rank by">
            <select name="sort" defaultValue={filters.sort}>
              {LEADERBOARD_SORTS.map((sort) => (
                <option key={sort.key} value={sort.key}>
                  {sort.label}
                </option>
              ))}
            </select>
          </ScopeSelect>

          <ScopeSelect icon={ShieldCheck} label="Record trust" last>
            <select
              name="record"
              defaultValue={filters.verifiedOnly ? "verified" : "all"}
            >
              <option value="verified">Verified only</option>
              <option value="all">All records</option>
            </select>
          </ScopeSelect>
        </div>
        <Button
          type="submit"
          className="h-11 shrink-0 border-[color:var(--scl-blue)] bg-[color:var(--scl-blue)] px-5 text-[color:var(--scl-blue-ink)] hover:bg-[color:var(--scl-blue)]/90"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          Apply
        </Button>
      </div>

      <div className="mt-2 flex min-h-9 items-center justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <AppliedChip
            label={sportLabel}
            href={leaderboardHref(filters, { sport: "ALL" }, action)}
          />
          <AppliedChip
            label={windowLabel}
            href={leaderboardHref(filters, { window: "all" }, action)}
          />
          <AppliedChip
            label={sortLabel}
            href={leaderboardHref(filters, { sort: "units" }, action)}
          />
          <AppliedChip
            label={filters.verifiedOnly ? "Verified only" : "All records"}
            href={leaderboardHref(
              filters,
              { verifiedOnly: !filters.verifiedOnly },
              action,
            )}
          />
          <Link
            href={action}
            className="text-muted-foreground focus-visible:ring-ring hover:text-foreground inline-flex min-h-10 items-center rounded px-2 text-xs font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            Clear all
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <label>
            <span className="sr-only">Minimum sample</span>
            <select
              name="minPicks"
              defaultValue={String(filters.minPicks)}
              className="border-input bg-card focus-visible:ring-ring h-10 rounded-[8px] border px-2 text-xs outline-none focus-visible:ring-2"
            >
              {LEADERBOARD_MIN_PICKS.map((count) => (
                <option key={count} value={String(count)}>
                  {count === 0 ? "Any sample" : `${count}+ picks`}
                </option>
              ))}
            </select>
          </label>
          <label className="border-input bg-card focus-within:ring-ring flex h-10 w-40 items-center gap-2 rounded-[8px] border px-2 focus-within:ring-2">
            <Search className="text-muted-foreground size-3.5" aria-hidden />
            <span className="sr-only">Find a capper</span>
            <input
              type="search"
              name="q"
              defaultValue={filters.search}
              placeholder="Handle"
              className="min-w-0 flex-1 bg-transparent text-xs outline-none"
            />
          </label>
          <Button
            render={<Link href={action} />}
            nativeButton={false}
            variant="outline"
            size="icon"
            className="size-10"
            aria-label="Reset leaderboard scope"
            title="Reset"
          >
            <RotateCcw className="size-3.5" aria-hidden />
          </Button>
        </div>
      </div>
    </form>
  );
}

function ScopeSelect({
  icon: Icon,
  label,
  last = false,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  last?: boolean;
  children: React.ReactElement<{ className?: string }>;
}) {
  return (
    <label
      className={cn(
        "relative flex min-w-0 items-center gap-2 px-3",
        !last && "border-r border-[color:var(--scl-line)]",
      )}
    >
      <Icon
        className="size-4 shrink-0 text-[color:var(--scl-muted-data)]"
        aria-hidden
      />
      <span className="sr-only">{label}</span>
      <div className="min-w-0 flex-1 [&>select]:h-10 [&>select]:w-full [&>select]:appearance-none [&>select]:truncate [&>select]:bg-transparent [&>select]:pr-6 [&>select]:text-sm [&>select]:font-semibold [&>select]:outline-none">
        {children}
      </div>
      <ChevronDown
        className="pointer-events-none absolute right-2 size-3.5 text-[color:var(--scl-muted-label)]"
        aria-hidden
      />
    </label>
  );
}

function AppliedChip({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="border-border bg-card focus-visible:ring-ring inline-flex min-h-10 items-center gap-1.5 rounded-[8px] border px-2.5 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
    >
      {label}
      <X className="size-3 text-[color:var(--scl-muted-label)]" aria-hidden />
    </Link>
  );
}

function MobileScopeForm({
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
      className={cn("grid grid-cols-2 gap-2", className)}
    >
      {filters.limit !== 10 ? (
        <input type="hidden" name="limit" value={filters.limit} />
      ) : null}
      <MobileSelect label="Sport" name="sport" value={filters.sport}>
        <option value="ALL">All sports</option>
        {SPORTS.map((sport) => (
          <option key={sport.key} value={sport.key}>
            {sport.label}
          </option>
        ))}
      </MobileSelect>
      <MobileSelect label="Time scope" name="window" value={filters.window}>
        {LEADERBOARD_SCOPE_WINDOWS.map((window) => (
          <option key={window.key} value={window.key}>
            {window.longLabel}
          </option>
        ))}
      </MobileSelect>
      <MobileSelect label="Rank by" name="sort" value={filters.sort}>
        {LEADERBOARD_SORTS.map((sort) => (
          <option key={sort.key} value={sort.key}>
            {sort.label}
          </option>
        ))}
      </MobileSelect>
      <MobileSelect
        label="Minimum sample"
        name="minPicks"
        value={String(filters.minPicks)}
      >
        {LEADERBOARD_MIN_PICKS.map((count) => (
          <option key={count} value={String(count)}>
            {count === 0 ? "Any sample" : `${count}+ picks`}
          </option>
        ))}
      </MobileSelect>
      <MobileSelect
        label="Record trust"
        name="record"
        value={filters.verifiedOnly ? "verified" : "all"}
      >
        <option value="verified">Verified only</option>
        <option value="all">All records</option>
      </MobileSelect>
      <label>
        <span className="scl-eyebrow text-[color:var(--scl-muted-label)]">
          Find a capper
        </span>
        <span className="border-input bg-surface-2 focus-within:ring-ring mt-1 flex h-11 items-center gap-2 rounded-[8px] border px-2 focus-within:ring-2">
          <Search className="text-muted-foreground size-3.5" aria-hidden />
          <input
            type="search"
            name="q"
            defaultValue={filters.search}
            placeholder="Handle"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </span>
      </label>
      <Button
        type="submit"
        className="col-span-2 min-h-11 border-[color:var(--scl-blue)] bg-[color:var(--scl-blue)] text-[color:var(--scl-blue-ink)] hover:bg-[color:var(--scl-blue)]/90"
      >
        Apply scope
      </Button>
      <Link
        href={action}
        className="text-muted-foreground col-span-2 min-h-11 rounded-[8px] py-3 text-center text-sm font-semibold"
      >
        Reset filters
      </Link>
    </form>
  );
}

function MobileSelect({
  label,
  name,
  value,
  children,
}: {
  label: string;
  name: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="scl-eyebrow text-[color:var(--scl-muted-label)]">
        {label}
      </span>
      <select
        name={name}
        defaultValue={value}
        className="border-input bg-surface-2 focus-visible:ring-ring mt-1 h-11 w-full rounded-[8px] border px-2 text-sm outline-none focus-visible:ring-2"
      >
        {children}
      </select>
    </label>
  );
}
