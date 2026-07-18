"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  Check,
  GitCompareArrows,
  Pin,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CapperAvatar } from "@/components/scl/capper-avatar";
import { CapperIdentityLabel } from "@/components/scl/capper-identity-label";
import { SportTag } from "@/components/scl/badges";
import { RecentFormStrip } from "@/components/scl/indicators";
import type { LeaderboardFilters, LeaderboardSort } from "@/lib/leaderboard";
import type { CapperSummary } from "@/lib/mock";
import { formatRecord, formatRoi, formatUnits } from "@/lib/format";
import { perfScale, perfToneClass } from "@/lib/perf-scale";
import { isProvisional, sampleMaturity } from "@/lib/sample";
import { cn } from "@/lib/utils";

const MAX_COMPARE = 3;

function scopeHref(
  filters: LeaderboardFilters,
  changes: Partial<LeaderboardFilters>,
) {
  const next = { ...filters, ...changes };
  const params = new URLSearchParams({
    sport: next.sport,
    window: next.window,
    sort: next.sort,
    minPicks: String(next.minPicks),
    record: next.verifiedOnly ? "verified" : "all",
    limit: String(next.limit),
  });
  if (next.search) params.set("q", next.search);
  return `/leaderboard?${params.toString()}`;
}

export function LeaderboardRankView({
  cappers,
  filters,
  failed = false,
}: {
  cappers: CapperSummary[];
  filters: LeaderboardFilters;
  failed?: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const visible = cappers.slice(0, filters.limit);
  const selected = useMemo(
    () =>
      selectedIds.flatMap(
        (id) => cappers.find((capper) => capper.id === id) ?? [],
      ),
    [cappers, selectedIds],
  );

  function toggleCompare(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : current.length < MAX_COMPARE
          ? [...current, id]
          : current,
    );
  }

  if (!visible.length) {
    return (
      <div className="border-border bg-card rounded-[var(--scl-radius-card)] border p-6 text-center sm:p-10">
        <h2 className="text-lg font-semibold">
          {failed
            ? "Leaderboard unavailable"
            : "No ranked cappers in this scope"}
        </h2>
        <p className="text-muted-foreground mx-auto mt-2 max-w-xl text-sm">
          {failed
            ? "Performance data is temporarily unavailable. Try again shortly."
            : "No cappers meet this scope’s ranking requirements yet. Try a broader window or smaller minimum sample."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border-border bg-card hidden overflow-x-auto rounded-[var(--scl-radius-card)] border md:block">
        <table className="w-full min-w-[68rem] table-fixed border-collapse text-sm">
          <caption className="sr-only">
            Read-only capper rankings for the selected scope. Select a metric
            heading to sort.
          </caption>
          <colgroup>
            <col className="w-[5.25rem]" />
            <col className="w-[14rem]" />
            <col className="w-[7rem]" />
            <col className="w-[6rem]" />
            <col className="w-[5.5rem]" />
            <col className="w-[5.5rem]" />
            <col className="w-[8.5rem]" />
            <col className="w-[8.5rem]" />
            <col className="w-[9rem]" />
          </colgroup>
          <thead className="border-border bg-surface-2 border-b">
            <tr>
              <PlainHeader label="Rank" />
              <PlainHeader label="Capper" />
              <PlainHeader label="Sports" />
              <SortHeader label="Record" sort="winPct" filters={filters} />
              <SortHeader label="ROI" sort="roi" filters={filters} />
              <SortHeader label="Units" sort="units" filters={filters} />
              <SortHeader label="Sample" sort="sample" filters={filters} />
              <SortHeader label="Verified" sort="verified" filters={filters} />
              <SortHeader label="Form" sort="form" filters={filters} />
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {visible.map((capper) => {
              const selectedForCompare = selectedIds.includes(capper.id);
              const compareDisabled =
                !selectedForCompare && selectedIds.length >= MAX_COMPARE;
              return (
                <tr
                  key={capper.id}
                  className="hover:bg-surface-2/70 focus-within:bg-surface-2/70"
                >
                  <td className="px-3 py-3 align-middle">
                    <RankRail capper={capper} />
                  </td>
                  <td className="px-2 py-3 align-middle">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-pressed={selectedForCompare}
                        aria-label={`${selectedForCompare ? "Remove" : "Add"} ${capper.name} ${selectedForCompare ? "from" : "to"} comparison`}
                        title={
                          compareDisabled
                            ? "Compare tray is limited to three cappers"
                            : "Pin for comparison"
                        }
                        disabled={compareDisabled}
                        onClick={() => toggleCompare(capper.id)}
                        className={cn(
                          "focus-visible:ring-ring flex size-9 shrink-0 items-center justify-center rounded-lg border outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40",
                          selectedForCompare
                            ? "border-[color:var(--scl-blue)] bg-[color:var(--scl-blue)] text-[color:var(--scl-blue-ink)]"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {selectedForCompare ? (
                          <Check className="size-4" />
                        ) : (
                          <Pin className="size-4" />
                        )}
                      </button>
                      <Link
                        href={`/cappers/${capper.handle}`}
                        className="focus-visible:ring-ring flex min-w-0 items-center gap-2 rounded-md outline-none focus-visible:ring-2"
                      >
                        <CapperAvatar
                          name={capper.name}
                          src={capper.avatarUrl}
                          size="sm"
                        />
                        <CapperIdentityLabel
                          capper={capper}
                          compact
                          verified={false}
                        />
                      </Link>
                    </div>
                  </td>
                  <td className="px-2 py-3 align-middle">
                    <Sports capper={capper} />
                  </td>
                  <DataCell
                    value={formatRecord(
                      capper.record.w,
                      capper.record.l,
                      capper.record.p,
                    )}
                  />
                  <PerformanceCell
                    metric="roi"
                    value={capper.roi}
                    graded={capper.settledPicks ?? 0}
                  />
                  <PerformanceCell
                    metric="units"
                    value={capper.units}
                    graded={capper.settledPicks ?? 0}
                  />
                  <td className="px-2 py-3 align-middle">
                    <MaturityMeter count={capper.settledPicks ?? 0} />
                  </td>
                  <td className="px-2 py-3 align-middle">
                    <VerificationMeter share={capper.verifiedShare} />
                  </td>
                  <td className="px-2 py-3 align-middle">
                    <RecentFormStrip form={capper.recentForm.slice(-5)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden" aria-label="Ranked cappers">
        {visible.map((capper) => {
          const selectedForCompare = selectedIds.includes(capper.id);
          return (
            <article
              key={capper.id}
              className="border-border bg-card rounded-[var(--scl-radius-card)] border p-3.5"
            >
              <div className="flex items-start gap-3">
                <RankRail capper={capper} />
                <Link
                  href={`/cappers/${capper.handle}`}
                  className="focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-2 rounded-md outline-none focus-visible:ring-2"
                >
                  <CapperAvatar
                    name={capper.name}
                    src={capper.avatarUrl}
                    size="md"
                  />
                  <div className="min-w-0">
                    <CapperIdentityLabel
                      capper={capper}
                      compact
                      verified={false}
                    />
                    <div className="mt-1">
                      <Sports capper={capper} />
                    </div>
                  </div>
                </Link>
                <button
                  type="button"
                  aria-pressed={selectedForCompare}
                  aria-label={`${selectedForCompare ? "Remove" : "Add"} ${capper.name} ${selectedForCompare ? "from" : "to"} comparison`}
                  disabled={
                    !selectedForCompare && selectedIds.length >= MAX_COMPARE
                  }
                  onClick={() => toggleCompare(capper.id)}
                  className={cn(
                    "focus-visible:ring-ring flex size-11 shrink-0 items-center justify-center rounded-lg border outline-none focus-visible:ring-2 disabled:opacity-40",
                    selectedForCompare
                      ? "border-[color:var(--scl-blue)] bg-[color:var(--scl-blue)] text-[color:var(--scl-blue-ink)]"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {selectedForCompare ? (
                    <Check className="size-4" />
                  ) : (
                    <Pin className="size-4" />
                  )}
                </button>
              </div>
              <dl className="border-border mt-3 grid grid-cols-3 border-y py-3">
                <MobileMetric
                  label="Record"
                  value={formatRecord(
                    capper.record.w,
                    capper.record.l,
                    capper.record.p,
                  )}
                />
                <MobileMetric
                  label="ROI"
                  value={formatRoi(capper.roi)}
                  tone={perfToneClass(
                    perfScale("roi", capper.roi, {
                      gradedCount: capper.settledPicks,
                    }).tone,
                  )}
                />
                <MobileMetric
                  label="Units"
                  value={formatUnits(capper.units)}
                  tone={perfToneClass(
                    perfScale("units", capper.units, {
                      gradedCount: capper.settledPicks,
                    }).tone,
                  )}
                />
              </dl>
              <div className="mt-3 grid gap-3">
                <MaturityMeter count={capper.settledPicks ?? 0} />
                <VerificationMeter share={capper.verifiedShare} />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground text-xs">
                    Recent form
                  </span>
                  <RecentFormStrip form={capper.recentForm.slice(-5)} />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs tabular-nums">
          Showing {visible.length} of {cappers.length} ranked{" "}
          {cappers.length === 1 ? "capper" : "cappers"}
        </p>
        <div className="flex items-center gap-1" aria-label="Rows shown">
          {[10, 20, 50].map((limit) => (
            <Link
              key={limit}
              href={scopeHref(filters, {
                limit: limit as LeaderboardFilters["limit"],
              })}
              aria-current={filters.limit === limit ? "page" : undefined}
              className={cn(
                "focus-visible:ring-ring inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border px-2 text-sm font-semibold tabular-nums outline-none focus-visible:ring-2",
                filters.limit === limit
                  ? "border-[color:var(--scl-blue)] bg-[color:var(--scl-blue)] text-[color:var(--scl-blue-ink)]"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {limit}
            </Link>
          ))}
        </div>
      </div>

      {selected.length > 0 ? (
        <CompareTray selected={selected} onRemove={toggleCompare} />
      ) : null}
    </>
  );
}

function PlainHeader({ label }: { label: string }) {
  return (
    <th
      scope="col"
      className="text-muted-foreground px-2 py-3 text-left text-[0.7rem] font-semibold tracking-wide uppercase"
    >
      {label}
    </th>
  );
}

function SortHeader({
  label,
  sort,
  filters,
}: {
  label: string;
  sort: LeaderboardSort;
  filters: LeaderboardFilters;
}) {
  const active = filters.sort === sort;
  return (
    <th
      scope="col"
      aria-sort={active ? "descending" : "none"}
      className="px-2 py-2 text-right"
    >
      <Link
        href={scopeHref(filters, { sort })}
        className={cn(
          "focus-visible:ring-ring inline-flex min-h-9 items-center justify-end gap-1 rounded-md px-1 text-[0.7rem] font-semibold tracking-wide uppercase outline-none focus-visible:ring-2",
          active
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {label}
        <ArrowDown
          className={cn(
            "size-3",
            active ? "text-[color:var(--scl-blue)]" : "opacity-0",
          )}
          aria-hidden
        />
        <span className="sr-only">
          {active ? ", sorted descending" : ", sort descending"}
        </span>
      </Link>
    </th>
  );
}

function RankRail({ capper }: { capper: CapperSummary }) {
  const provisional = isProvisional(capper.settledPicks);
  const changed = capper.rankDelta != null && capper.rankDelta !== 0;
  const deltaLabel =
    capper.rankDelta == null
      ? "Previous rank unavailable"
      : capper.rankDelta === 0
        ? "No rank change"
        : `${capper.rankDelta > 0 ? "Up" : "Down"} ${Math.abs(capper.rankDelta)} ${Math.abs(capper.rankDelta) === 1 ? "place" : "places"}`;
  return (
    <div className="border-l-2 border-[color:var(--scl-line)] pl-2">
      <div
        className={cn(
          "scl-data text-lg font-bold tabular-nums",
          capper.rank <= 3 && "text-[color:var(--scl-pink)]",
        )}
      >
        #{capper.rank}
      </div>
      <div
        className={cn(
          "scl-data text-muted-foreground mt-0.5 text-[0.65rem] font-semibold tabular-nums",
          changed &&
            "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-y-1 motion-safe:duration-[240ms] motion-reduce:animate-none",
        )}
        title={deltaLabel}
        aria-label={deltaLabel}
      >
        {capper.rankDelta == null
          ? "Δ —"
          : capper.rankDelta === 0
            ? "Δ —"
            : capper.rankDelta > 0
              ? `↑${capper.rankDelta}`
              : `↓${Math.abs(capper.rankDelta)}`}
      </div>
      {provisional ? (
        <span
          className="mt-1 block text-[0.6rem] font-semibold tracking-wide text-[color:var(--scl-perf-mid)] uppercase"
          title="Early sample; rank can change as more picks are graded"
        >
          Provisional
        </span>
      ) : null}
    </div>
  );
}

function Sports({ capper }: { capper: CapperSummary }) {
  const sports = Array.from(
    new Set([capper.topSport, ...(capper.sports ?? [])]),
  )
    .filter(Boolean)
    .slice(0, 2);
  return (
    <div className="flex flex-wrap gap-1">
      {sports.map((sport) => (
        <SportTag key={sport} sport={sport} markOnly />
      ))}
    </div>
  );
}

function DataCell({ value }: { value: string }) {
  return (
    <td className="scl-data px-2 py-3 text-right font-semibold tabular-nums">
      {value}
    </td>
  );
}

function PerformanceCell({
  metric,
  value,
  graded,
}: {
  metric: "roi" | "units";
  value: number;
  graded: number;
}) {
  const result = perfScale(metric, value, { gradedCount: graded });
  return (
    <td
      className={cn(
        "scl-data px-2 py-3 text-right font-semibold tabular-nums",
        perfToneClass(result.tone),
      )}
      aria-label={result.ariaLabel}
    >
      {metric === "roi" ? formatRoi(value) : formatUnits(value)}
    </td>
  );
}

function MaturityMeter({ count }: { count: number }) {
  const maturity = sampleMaturity(count);
  const width = Math.min(100, (count / 50) * 100);
  const tone =
    maturity === "Established"
      ? "var(--scl-perf-strong)"
      : "var(--scl-perf-mid)";
  return (
    <div title={`${maturity}: ${count} graded picks`}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{maturity}</span>
        <span className="scl-data font-semibold tabular-nums">{count}</span>
      </div>
      <div
        className="bg-surface-3 mt-1.5 h-1.5 overflow-hidden rounded-full"
        role="progressbar"
        aria-label={`${maturity} sample, ${count} graded picks`}
        aria-valuemin={0}
        aria-valuemax={50}
        aria-valuenow={Math.min(50, count)}
      >
        <span
          className="block h-full rounded-full"
          style={{ width: `${width}%`, backgroundColor: tone }}
        />
      </div>
    </div>
  );
}

function VerificationMeter({ share }: { share: number | null | undefined }) {
  if (share == null) {
    return (
      <span
        className="text-muted-foreground"
        title="Verification share unavailable"
      >
        —
      </span>
    );
  }
  const bounded = Math.max(0, Math.min(100, share));
  return (
    <div
      title={`${share.toFixed(0)}% of tracked picks were board-verified at submission`}
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <ShieldCheck
          className="size-4 text-[color:var(--scl-pink)]"
          aria-hidden
        />
        <span className="scl-data font-semibold tabular-nums">
          {share.toFixed(0)}%
        </span>
      </div>
      <div
        className="bg-surface-3 mt-1.5 h-1.5 overflow-hidden rounded-full"
        role="progressbar"
        aria-label={`${share.toFixed(0)}% board-verified at submission`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(bounded)}
      >
        <span
          className="block h-full rounded-full bg-[color:var(--scl-pink)]"
          style={{ width: `${bounded}%` }}
        />
      </div>
    </div>
  );
}

function MobileMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="px-1 text-center">
      <dt className="text-muted-foreground text-[0.65rem] font-semibold tracking-wide uppercase">
        {label}
      </dt>
      <dd className={cn("scl-data mt-1 font-semibold tabular-nums", tone)}>
        {value}
      </dd>
    </div>
  );
}

function CompareTray({
  selected,
  onRemove,
}: {
  selected: CapperSummary[];
  onRemove: (id: string) => void;
}) {
  return (
    <div
      className="border-border bg-card motion-safe:animate-in motion-safe:slide-in-from-bottom-2 fixed right-3 bottom-[calc(env(safe-area-inset-bottom)+5rem)] left-3 z-30 rounded-[var(--scl-radius-card)] border p-3 shadow-[var(--scl-shadow-slip)] motion-safe:duration-200 motion-reduce:animate-none md:right-auto md:bottom-4 md:left-1/2 md:w-[min(44rem,calc(100vw-2rem))] md:-translate-x-1/2"
      aria-label="Capper comparison tray"
    >
      <div className="flex items-center gap-3">
        <GitCompareArrows
          className="size-4 shrink-0 text-[color:var(--scl-blue)]"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Compare cappers</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {selected.map((capper) => (
              <button
                key={capper.id}
                type="button"
                onClick={() => onRemove(capper.id)}
                className="border-border bg-surface-2 focus-visible:ring-ring inline-flex min-h-8 items-center rounded-lg border px-2 text-xs outline-none focus-visible:ring-2"
                aria-label={`Remove ${capper.name} from comparison`}
              >
                {capper.name}{" "}
                <span className="text-muted-foreground ml-1" aria-hidden>
                  ×
                </span>
              </button>
            ))}
          </div>
        </div>
        <Dialog>
          <DialogTrigger
            render={
              <Button
                disabled={selected.length < 2}
                className="bg-[color:var(--scl-blue)] text-[color:var(--scl-blue-ink)] hover:bg-[color:var(--scl-blue-deep)]"
              />
            }
          >
            Compare {selected.length}/3
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Capper comparison</DialogTitle>
              <DialogDescription>
                Metrics use the leaderboard’s current scope. Samples may still
                be provisional.
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <caption className="sr-only">
                  Comparison of selected cappers
                </caption>
                <thead>
                  <tr className="border-border border-b">
                    <th scope="col" className="py-2 text-left">
                      Metric
                    </th>
                    {selected.map((capper) => (
                      <th
                        key={capper.id}
                        scope="col"
                        className="px-2 py-2 text-right"
                      >
                        {capper.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  <CompareRow
                    label="Record"
                    selected={selected}
                    value={(capper) =>
                      formatRecord(
                        capper.record.w,
                        capper.record.l,
                        capper.record.p,
                      )
                    }
                  />
                  <CompareRow
                    label="ROI"
                    selected={selected}
                    value={(capper) => formatRoi(capper.roi)}
                  />
                  <CompareRow
                    label="Units"
                    selected={selected}
                    value={(capper) => formatUnits(capper.units)}
                  />
                  <CompareRow
                    label="Sample"
                    selected={selected}
                    value={(capper) => String(capper.settledPicks ?? 0)}
                  />
                  <CompareRow
                    label="Verified"
                    selected={selected}
                    value={(capper) =>
                      capper.verifiedShare == null
                        ? "—"
                        : `${capper.verifiedShare.toFixed(0)}%`
                    }
                  />
                </tbody>
              </table>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {selected.length < 2 ? (
        <p className="text-muted-foreground mt-2 text-xs">
          Pin one more capper to compare.
        </p>
      ) : null}
    </div>
  );
}

function CompareRow({
  label,
  selected,
  value,
}: {
  label: string;
  selected: CapperSummary[];
  value: (capper: CapperSummary) => string;
}) {
  return (
    <tr>
      <th
        scope="row"
        className="text-muted-foreground py-2 text-left font-medium"
      >
        {label}
      </th>
      {selected.map((capper) => (
        <td
          key={capper.id}
          className="scl-data px-2 py-2 text-right font-semibold tabular-nums"
        >
          {value(capper)}
        </td>
      ))}
    </tr>
  );
}
