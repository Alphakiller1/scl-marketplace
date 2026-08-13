"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, Trophy } from "lucide-react";

import { CapperAvatar } from "@/components/scl/capper-avatar";
import { CapperIdentityLabel } from "@/components/scl/capper-identity-label";
import { SportTag } from "@/components/scl/badges";
import { CompactCapperRow } from "@/components/scl/compact-capper-row";
import {
  RankMovementIndicator,
  RecentFormStrip,
} from "@/components/scl/indicators";
import { RankBadge } from "@/components/scl/rank-badge";
import { SampleMaturityMeter } from "@/components/scl/sample-maturity-meter";
import { EmptyState } from "@/components/scl/states";
import { StatValue } from "@/components/scl/stat-value";
import { LEADERBOARD_TABLE_MIN_WIDTH } from "@/components/scl/leaderboard-table";
import { formatRecord, formatRoi, formatUnits } from "@/lib/format";
import {
  LEADERBOARD_LIMITS,
  leaderboardHref,
  sortLeaderboard,
  type LeaderboardFilters,
  type LeaderboardSort,
} from "@/lib/leaderboard";
import type { CapperSummary } from "@/lib/mock";
import { perfScale, perfToneClass } from "@/lib/perf-scale";
import { isProvisional } from "@/lib/sample";
import { cn } from "@/lib/utils";

const METRIC_SORTS: {
  key: LeaderboardSort;
  label: string;
  align?: "left" | "right";
  thClassName?: string;
}[] = [
  { key: "winPct", label: "Win%", align: "right" },
  { key: "roi", label: "ROI", align: "right" },
  { key: "units", label: "Units", align: "right" },
  {
    key: "sample",
    label: "Sample",
    align: "right",
    thClassName: "min-w-[5.75rem]",
  },
  { key: "form", label: "Form", align: "right" },
];

export function Leaderboard({
  cappers,
  filters,
  limit: limitProp,
  failed = false,
  compactMobile = false,
  compactDesktop = false,
  flush = false,
  rankByPosition = false,
  primaryMetric = "units",
  emptyDescription = "No cappers match this ranking scope yet.",
  emptyTitle,
  showExpand = false,
}: {
  cappers: CapperSummary[];
  filters?: LeaderboardFilters;
  /** Explicit row cap (homepage snapshots). Overrides filters.limit when set. */
  limit?: number;
  failed?: boolean;
  compactMobile?: boolean;
  compactDesktop?: boolean;
  /** Hairline rows instead of nested cards (live evidence field). */
  flush?: boolean;
  rankByPosition?: boolean;
  primaryMetric?: "units" | "roi";
  emptyDescription?: string;
  emptyTitle?: string;
  showExpand?: boolean;
}) {
  const activeSort = filters?.sort ?? "units";

  const ordered = useMemo(() => {
    if (!filters) return cappers;
    return sortLeaderboard(cappers, activeSort, filters.direction ?? "desc");
  }, [cappers, filters, activeSort]);

  const scopedLimit =
    typeof limitProp === "number"
      ? limitProp
      : showExpand || filters
        ? (filters?.limit ?? ordered.length)
        : ordered.length;
  const visible = ordered.slice(0, scopedLimit);

  if (!visible.length) {
    return (
      <EmptyState
        icon={Trophy}
        title={
          failed
            ? "Couldn't load the leaderboard"
            : (emptyTitle ?? "No ranked cappers found")
        }
        description={
          failed
            ? "Performance data is temporarily unavailable. Please try again shortly."
            : emptyDescription
        }
      />
    );
  }

  // Ranked boards: place follows current sort order (1…n).
  // Building-a-record rows keep rank 0 (em dash).
  const place = (capper: CapperSummary, index: number) => {
    if (capper.rank === 0) return 0;
    if (rankByPosition || filters) return index + 1;
    return capper.rank ?? index + 1;
  };

  if (compactDesktop) {
    return (
      <div
        className={
          flush ? "border-border divide-border divide-y border-y" : "space-y-2"
        }
      >
        {visible.map((capper, index) => (
          <CompactCapperRow
            key={capper.id}
            capper={capper}
            rank={place(capper, index)}
            primaryMetric={primaryMetric}
            variant={flush ? "flush" : "card"}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="border-border scl-elevated hidden overflow-hidden rounded-[14px] border xl:block">
        <table
          className={cn(
            "w-full border-collapse text-sm",
            LEADERBOARD_TABLE_MIN_WIDTH,
          )}
        >
          <caption className="sr-only">
            Ranked cappers for the selected scope. Click a metric column title
            to reorder; rank numbers update with the sort.
          </caption>
          <thead>
            <tr className="text-muted-foreground border-border border-b text-[0.65rem] font-semibold tracking-wide uppercase">
              {/* SortableTh renders its own <th>; wrapping it in another one is
                  invalid HTML and was tripping a hydration error on this page. */}
              {filters ? (
                <SortableTh
                  sortKey="units"
                  label="Rank"
                  filters={filters}
                  activeSort={activeSort}
                  align="left"
                  className="w-16"
                />
              ) : (
                <th
                  scope="col"
                  className="w-16 px-1.5 py-2 text-left font-semibold"
                >
                  Rank
                </th>
              )}
              <th
                scope="col"
                className="min-w-[9.5rem] px-1.5 py-2 text-left font-semibold"
              >
                Capper
              </th>
              {/* No Package column: attribution is off until capper opt-in.
                  The Buy control below stays — it is a purchase CTA, not a
                  claim about which offer produced the record. */}
              <th scope="col" className="px-1.5 py-2 text-left font-semibold">
                Sports
              </th>
              <th scope="col" className="px-1.5 py-2 text-right font-semibold">
                Record
              </th>
              {METRIC_SORTS.map((col) => (
                <SortableTh
                  key={col.key}
                  sortKey={col.key}
                  label={col.label}
                  filters={filters}
                  activeSort={activeSort}
                  align={col.align}
                  className={col.thClassName}
                />
              ))}
              <th
                scope="col"
                className="w-14 px-1.5 py-2 text-center font-semibold"
              >
                Buy
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {visible.map((capper, index) => (
              <LeaderboardTableRow
                key={capper.id}
                capper={capper}
                rank={place(capper, index)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 xl:hidden">
        {visible.map((capper, index) => (
          <LeaderboardMobileCard
            key={capper.id}
            capper={capper}
            rank={place(capper, index)}
            compact={compactMobile || !compactDesktop}
            primaryMetric={primaryMetric}
          />
        ))}
      </div>

      {showExpand && filters ? (
        <ExpandControls filters={filters} total={ordered.length} />
      ) : null}
    </div>
  );
}

function SortableTh({
  sortKey,
  label,
  filters,
  activeSort,
  align = "right",
  className,
}: {
  sortKey: LeaderboardSort;
  label: string;
  filters?: LeaderboardFilters;
  activeSort?: LeaderboardSort;
  align?: "left" | "right";
  className?: string;
}) {
  const active = (activeSort ?? filters?.sort) === sortKey;
  const direction = filters?.direction ?? "desc";
  const href = filters
    ? leaderboardHref(filters, {
        sort: sortKey,
        direction: active && direction === "desc" ? "asc" : "desc",
      })
    : `/leaderboard?sort=${sortKey}`;

  return (
    <th
      scope="col"
      aria-sort={
        active ? (direction === "asc" ? "ascending" : "descending") : "none"
      }
      className={cn(
        "px-1.5 py-0 font-semibold",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      <Link
        href={href}
        scroll={false}
        title={`Sort by ${label}`}
        className={cn(
          "hover:text-foreground focus-visible:ring-ring inline-flex min-h-10 min-w-11 cursor-pointer items-center gap-0.5 rounded-md px-1 transition-colors focus-visible:ring-2 focus-visible:outline-none",
          align === "right" && "justify-end",
          active
            ? "text-foreground underline decoration-[color:var(--scl-blue)] underline-offset-4"
            : "text-muted-foreground hover:underline hover:decoration-[color:var(--scl-blue)]/60 hover:underline-offset-4",
        )}
      >
        {label}
        {active ? (
          <ChevronDown
            className={cn(
              "size-3.5 text-[color:var(--scl-blue)]",
              direction === "asc" && "rotate-180",
            )}
            aria-hidden
          />
        ) : null}
      </Link>
    </th>
  );
}

function ExpandControls({
  filters,
  total,
}: {
  filters: LeaderboardFilters;
  total: number;
}) {
  if (total <= 10) return null;
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-2"
      role="group"
      aria-label="Rows to show"
    >
      {LEADERBOARD_LIMITS.filter(
        (n) => n <= Math.max(total, 10) || n === 50,
      ).map((n) => {
        const active = filters.limit === n;
        return (
          <Link
            key={n}
            href={leaderboardHref(filters, { limit: n })}
            className={cn(
              "inline-flex h-10 items-center rounded-[9px] border px-3.5 text-sm font-semibold tabular-nums transition-colors lg:h-9",
              active
                ? "border-[color:var(--scl-blue)] bg-[color:var(--scl-blue)] text-[color:var(--scl-blue-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]"
                : "border-border bg-card text-muted-foreground hover:text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-[color:var(--scl-blue)]",
            )}
          >
            {n}
          </Link>
        );
      })}
    </div>
  );
}

function LeaderboardTableRow({
  capper,
  rank,
}: {
  capper: CapperSummary;
  rank: number;
}) {
  const graded = capper.settledPicks ?? 0;
  const provisional = isProvisional(graded);
  const sports = (
    capper.sports?.length ? capper.sports : [capper.topSport]
  ).slice(0, 3);
  const roiScale = perfScale("roi", capper.roi, { gradedCount: graded });
  const unitsScale = perfScale("units", capper.units, { gradedCount: graded });
  return (
    <tr className="hover:bg-surface-2/80 group min-h-[4.5rem]">
      <td className="px-1.5 py-2 align-middle">
        <div className="flex items-center gap-1.5">
          <RankBadge
            rank={rank}
            settledPicks={graded}
            className="size-8 text-xs"
          />
          <div className="flex min-w-0 flex-col items-start leading-none">
            <RankMovementIndicator delta={capper.rankDelta} />
            {provisional ? (
              <span className="text-muted-foreground mt-0.5 text-[0.55rem] font-semibold tracking-wide uppercase">
                Early
              </span>
            ) : null}
          </div>
        </div>
      </td>
      <td className="px-1.5 py-2 align-middle">
        <div className="flex min-w-0 items-center gap-2">
          <CapperAvatar name={capper.name} src={capper.avatarUrl} size="sm" />
          <Link
            href={`/cappers/${capper.handle}`}
            prefetch={false}
            className="focus-visible:ring-ring inline-flex min-h-10 min-w-0 items-center rounded-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            <CapperIdentityLabel
              capper={capper}
              compact
              verified={false}
              primaryClassName="text-sm"
            />
          </Link>
        </div>
      </td>
      <td className="px-1.5 py-2 align-middle">
        <div className="flex flex-wrap items-center gap-1">
          {sports.map((sport) => (
            <SportTag key={sport} sport={sport} markOnly className="shrink-0" />
          ))}
        </div>
      </td>
      <td className="px-1.5 py-2 text-right align-middle">
        <StatValue tone="text" className="text-sm font-semibold tabular-nums">
          {formatRecord(capper.record.w, capper.record.l, capper.record.p)}
        </StatValue>
      </td>
      <td className="px-1.5 py-2 text-right align-middle">
        <span className="scl-data text-sm font-semibold tabular-nums">
          {capper.winPct.toFixed(1)}%
        </span>
      </td>
      <td className="px-1.5 py-2 text-right align-middle">
        <span
          className={cn(
            "scl-data text-sm font-semibold tabular-nums",
            perfToneClass(roiScale.tone),
          )}
          aria-label={roiScale.ariaLabel}
        >
          {formatRoi(capper.roi)}
        </span>
      </td>
      <td className="px-1.5 py-2 text-right align-middle">
        <span
          className={cn(
            "scl-data text-sm font-semibold tabular-nums",
            perfToneClass(unitsScale.tone),
          )}
          aria-label={unitsScale.ariaLabel}
        >
          {formatUnits(capper.units)}
        </span>
      </td>
      <td className="min-w-[5.75rem] overflow-hidden px-1.5 py-2 text-right align-middle">
        <div className="ml-auto w-full max-w-[6rem]">
          <SampleMaturityMeter graded={graded} compact />
        </div>
      </td>
      <td className="px-1.5 py-2 text-right align-middle">
        {capper.recentForm.length ? (
          <div className="flex justify-end">
            <RecentFormStrip form={capper.recentForm.slice(-5)} />
          </div>
        ) : (
          <span className="text-muted-foreground tabular-nums">—</span>
        )}
      </td>
      <td className="px-1.5 py-2 text-center align-middle">
        {capper.publicOffers ? (
          <Link
            href={capper.publicOffers.purchasePath}
            target="_blank"
            rel="noopener noreferrer"
            prefetch={false}
            className="focus-visible:ring-ring hover:bg-surface-3 inline-flex size-10 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:outline-none"
            aria-label={`Buy ${capper.publicOffers.featuredTitle} from @${capper.handle}`}
            title={`Open ${capper.publicOffers.featuredTitle}`}
          >
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

/** Mobile leaderboard card — never a compressed table. */
export function LeaderboardMobileCard({
  capper,
  rank,
  compact = false,
  primaryMetric = "units",
}: {
  capper: CapperSummary;
  rank?: number;
  compact?: boolean;
  primaryMetric?: "units" | "roi";
}) {
  const graded = capper.settledPicks ?? 0;
  const roiScale = perfScale("roi", capper.roi, { gradedCount: graded });
  const unitsScale = perfScale("units", capper.units, { gradedCount: graded });
  if (compact) {
    return (
      <CompactCapperRow
        capper={capper}
        rank={rank ?? capper.rank}
        primaryMetric={primaryMetric}
      />
    );
  }

  return (
    <article className="border-border scl-elevated flex min-h-40 flex-col gap-3 rounded-[14px] border p-3.5">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-0.5">
          <RankBadge rank={rank ?? capper.rank} settledPicks={graded} />
          <RankMovementIndicator delta={capper.rankDelta} />
        </div>
        <CapperAvatar name={capper.name} src={capper.avatarUrl} size="md" />
        <div className="min-w-0 flex-1">
          <Link
            href={`/cappers/${capper.handle}`}
            prefetch={false}
            className="focus-visible:ring-ring inline-flex min-h-10 items-center rounded-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            <CapperIdentityLabel capper={capper} compact verified={false} />
          </Link>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            <SportTag sport={capper.topSport} markOnly className="shrink-0" />
            <span aria-hidden className="text-border">
              ·
            </span>
            <span className="scl-data tabular-nums">
              {formatRecord(capper.record.w, capper.record.l, capper.record.p)}
            </span>
          </div>
        </div>
      </div>
      <div className="border-border grid grid-cols-3 gap-2 border-t pt-3">
        <MobileStat
          label="ROI"
          value={formatRoi(capper.roi)}
          className={perfToneClass(roiScale.tone)}
        />
        <MobileStat
          label="Units"
          value={formatUnits(capper.units)}
          className={perfToneClass(unitsScale.tone)}
        />
        <MobileStat label="Win%" value={`${capper.winPct.toFixed(1)}%`} />
      </div>
      <div className="bg-surface-2 flex min-h-10 items-center justify-between gap-3 rounded-lg px-3 py-2">
        <SampleMaturityMeter graded={graded} compact className="min-w-[4rem]" />
        {capper.recentForm.length ? (
          <RecentFormStrip form={capper.recentForm.slice(-5)} />
        ) : (
          <span className="text-muted-foreground text-xs">Form —</span>
        )}
      </div>
      {capper.publicOffers ? (
        <Link
          href={capper.publicOffers.purchasePath}
          target="_blank"
          rel="noopener noreferrer"
          prefetch={false}
          className="scl-link inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold"
        >
          {capper.publicOffers.count > 1
            ? `View ${capper.publicOffers.count} packages`
            : "View package"}
          <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </article>
  );
}

function MobileStat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className={cn("scl-data font-semibold tabular-nums", className)}>
        {value}
      </span>
      <span className="text-muted-foreground text-[0.7rem] font-medium tracking-wide uppercase">
        {label}
      </span>
    </div>
  );
}

/** Visually distinct unranked / below-minimum band — never shows competition places. */
export function BuildingRecordSection({
  cappers,
  failed = false,
}: {
  cappers: CapperSummary[];
  failed?: boolean;
}) {
  if (!cappers.length || failed) return null;

  return (
    <section
      id="building-a-record"
      aria-label="Building a record"
      className="border-border scl-elevated mt-8 scroll-mt-20 rounded-[14px] border border-dashed p-3 sm:mt-10 sm:p-4"
    >
      <div className="mb-3 flex flex-col gap-1 sm:mb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="scl-section-mark">
          <h2 className="scl-display text-sm font-bold tracking-wide normal-case">
            Building A Record
          </h2>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            These records remain public but unranked. They have no graded picks,
            do not meet the selected minimum sample, or have negative ROI or
            units in this scope.
          </p>
        </div>
        <p className="scl-data text-muted-foreground text-xs tabular-nums">
          {cappers.length.toLocaleString()}{" "}
          {cappers.length === 1 ? "capper" : "cappers"}
        </p>
      </div>
      <Leaderboard
        cappers={cappers}
        compactDesktop
        compactMobile
        emptyTitle="No cappers building a record"
        emptyDescription="Every matching capper currently meets the ranking sample."
      />
    </section>
  );
}

/** @deprecated Prefer LeaderboardTableRow via Leaderboard — kept for imports. */
export function LeaderboardRow({
  capper,
  rank,
}: {
  capper: CapperSummary;
  rank?: number;
}) {
  return (
    <LeaderboardTableRow capper={capper} rank={rank ?? capper.rank ?? 0} />
  );
}
