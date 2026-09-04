"use client";

import { useMemo, useState } from "react";
import { History } from "lucide-react";

import { SportTag } from "@/components/scl/badges";
import { formatPct, formatRecord, formatRoi, formatUnits } from "@/lib/format";
import type { LegacySportRecordView } from "@/lib/legacy-sport-records";
import { perfScale, perfToneClass } from "@/lib/perf-scale";
import { isProvisional, maturityLabel } from "@/lib/sample";
import { cn } from "@/lib/utils";

type SortKey = "units" | "roi" | "winPct" | "settled";

const SORT_OPTIONS: ReadonlyArray<{ value: SortKey; label: string }> = [
  { value: "units", label: "Units" },
  { value: "roi", label: "ROI" },
  { value: "winPct", label: "Win%" },
  { value: "settled", label: "Sample" },
];

function compareLegacyRows(
  a: LegacySportRecordView,
  b: LegacySportRecordView,
  sort: SortKey,
): number {
  const aMetric =
    sort === "units"
      ? a.units
      : sort === "roi"
        ? (a.roi ?? Number.NEGATIVE_INFINITY)
        : sort === "winPct"
          ? (a.winPct ?? Number.NEGATIVE_INFINITY)
          : a.settled;
  const bMetric =
    sort === "units"
      ? b.units
      : sort === "roi"
        ? (b.roi ?? Number.NEGATIVE_INFINITY)
        : sort === "winPct"
          ? (b.winPct ?? Number.NEGATIVE_INFINITY)
          : b.settled;
  if (bMetric !== aMetric) return bMetric - aMetric;
  if (b.units !== a.units) return b.units - a.units;
  return a.label.localeCompare(b.label);
}

/**
 * Career record broken down by sport: all-time legacy totals plus SCL-logged
 * positions, so the table sample matches Evidence Brief / the dashboard
 * scoreboard. Client-sortable. Numbers color by their own sign.
 */
export function LegacySportBreakdown({
  records,
  className,
  surface = "profile",
  carriesLegacy = true,
  scopeLabel,
}: {
  records: LegacySportRecordView[];
  className?: string;
  surface?: "profile" | "dashboard";
  /**
   * Whether the carried pre-import aggregate is inside these rows. False on
   * the profile's rolling scopes, which are receipt-only: the legacy export is
   * a frozen total with no per-pick dates, so it cannot sit in a trailing
   * window. Saying otherwise would describe a table that does not exist. The
   * false branch stays neutral rather than explaining the exclusion, because
   * most cappers never had a carried record to exclude.
   */
  carriesLegacy?: boolean;
  /** Scope these rows describe, when the caller is showing one. */
  scopeLabel?: string;
}) {
  const [sort, setSort] = useState<SortKey>("units");

  const sorted = useMemo(
    () => [...records].sort((a, b) => compareLegacyRows(a, b, sort)),
    [records, sort],
  );

  if (records.length === 0) return null;

  const totalSettled = records.reduce((sum, row) => sum + row.settled, 0);
  const sortLabel =
    SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "Units";
  const matchLabel =
    surface === "dashboard" ? "scoreboard" : "Evidence Brief sample";

  return (
    <section
      data-profile-legacy-sports
      aria-label="Record by sport"
      className={cn("border-border min-w-0 border-b pb-5", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-[color:var(--scl-blue)]/20 text-[color:var(--scl-blue)] ring-1 ring-[color:var(--scl-blue)]/35">
              <History className="size-3" aria-hidden />
            </span>
            <h2 className="scl-display text-base font-bold tracking-[0.04em]">
              By sport
            </h2>
          </div>
          <p className="text-muted-foreground mt-1 max-w-2xl text-xs leading-relaxed">
            Settled record in each sport
            {scopeLabel ? ` for ${scopeLabel}` : ""}
            {carriesLegacy
              ? " — including results carried over from the previous SCL platform — "
              : " — logged on SCL — "}
            so this table matches the {matchLabel}. Sorted by{" "}
            {sortLabel.toLowerCase()}. Each figure is colored from its own value
            — a winning ROI stays green even when units are flat. Sample size
            lives on the Early meter, not on every number.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <p className="scl-data text-muted-foreground text-xs tabular-nums">
            {records.length} sport{records.length === 1 ? "" : "s"} ·{" "}
            {totalSettled.toLocaleString()} settled
          </p>
          <div
            className="border-border bg-surface-2 inline-flex min-h-10 items-center rounded-[var(--scl-radius-chip)] border p-0.5"
            role="group"
            aria-label="Sort legacy sports"
          >
            {SORT_OPTIONS.map((option) => {
              const active = sort === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "scl-data min-h-9 min-w-11 rounded-full px-2.5 text-[0.68rem] leading-none font-semibold",
                    active
                      ? "bg-[color:var(--scl-blue)] text-[color:var(--scl-blue-ink)]"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-pressed={active}
                  onClick={() => setSort(option.value)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-border mt-4 hidden min-w-0 overflow-x-auto rounded-xl border md:block">
        <table className="w-full min-w-[36rem] table-fixed border-collapse">
          <caption className="sr-only">
            Sorted by {sortLabel.toLowerCase()}
          </caption>
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[16%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[18%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead>
            <tr className="border-border bg-surface-2 border-b">
              {(
                ["Sport", "Record", "Win%", "ROI", "Units", "Sample"] as const
              ).map((label) => (
                <th
                  key={label}
                  scope="col"
                  className={cn(
                    "scl-eyebrow px-3 py-2.5 text-[color:var(--scl-muted-data)]",
                    label === "Sport" ? "text-left" : "text-right",
                  )}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <LegacySportDesktopRow key={row.sport} row={row} />
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-border mt-3 divide-y md:hidden">
        {sorted.map((row) => (
          <li key={row.sport} className="py-3">
            <LegacySportMobileCard row={row} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function LegacySportDesktopRow({ row }: { row: LegacySportRecordView }) {
  const roiScale = perfScale("roi", row.roi, { gradedCount: row.settled });
  const unitsScale = perfScale("units", row.units, {
    gradedCount: row.settled,
  });
  const winScale = perfScale("winPct", row.winPct, {
    gradedCount: row.settled,
  });
  const early = isProvisional(row.settled);

  return (
    <tr className="border-border border-b last:border-b-0">
      <td className="min-w-0 px-3 py-3 align-middle">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <SportTag sport={row.sport} forceLabel />
          {early ? (
            <span className="scl-eyebrow text-[color:var(--scl-perf-mid-text)]">
              {maturityLabel(row.settled)}
            </span>
          ) : null}
        </div>
      </td>
      <td className="scl-data px-3 py-3 text-right text-sm font-semibold tabular-nums">
        {formatRecord(row.wins, row.losses, row.pushes)}
      </td>
      <td
        className={cn(
          "scl-data px-3 py-3 text-right text-sm font-semibold tabular-nums",
          row.winPct != null
            ? perfToneClass(winScale.tone)
            : "text-muted-foreground",
        )}
        aria-label={row.winPct != null ? winScale.ariaLabel : undefined}
      >
        {row.winPct != null ? formatPct(row.winPct) : "—"}
      </td>
      <td
        className={cn(
          "scl-data px-3 py-3 text-right text-sm font-semibold tabular-nums",
          row.roi != null
            ? perfToneClass(roiScale.tone)
            : "text-muted-foreground",
        )}
        aria-label={row.roi != null ? roiScale.ariaLabel : undefined}
      >
        {row.roi != null ? formatRoi(row.roi) : "—"}
      </td>
      <td
        className={cn(
          "scl-data px-3 py-3 text-right text-sm font-semibold tabular-nums",
          perfToneClass(unitsScale.tone),
        )}
        aria-label={unitsScale.ariaLabel}
      >
        {formatUnits(row.units)}
      </td>
      <td className="scl-data text-muted-foreground px-3 py-3 text-right text-sm tabular-nums">
        <span className="block">{row.settled.toLocaleString()}</span>
        <span className="mt-0.5 block text-[0.65rem]">
          {formatUnits(row.unitsRisked, true, false)} risked
        </span>
      </td>
    </tr>
  );
}

function LegacySportMobileCard({ row }: { row: LegacySportRecordView }) {
  const roiScale = perfScale("roi", row.roi, { gradedCount: row.settled });
  const unitsScale = perfScale("units", row.units, {
    gradedCount: row.settled,
  });
  const winScale = perfScale("winPct", row.winPct, {
    gradedCount: row.settled,
  });
  const early = isProvisional(row.settled);

  return (
    <article className="min-w-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <SportTag sport={row.sport} forceLabel />
          {early ? (
            <span className="scl-eyebrow text-[color:var(--scl-perf-mid-text)]">
              {maturityLabel(row.settled)}
            </span>
          ) : null}
        </div>
        <p
          className={cn(
            "scl-data shrink-0 text-sm font-semibold tabular-nums",
            perfToneClass(unitsScale.tone),
          )}
          aria-label={unitsScale.ariaLabel}
        >
          {formatUnits(row.units)}
        </p>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
        <MobileStat
          label="Record"
          value={formatRecord(row.wins, row.losses, row.pushes)}
        />
        <MobileStat
          label="Win%"
          value={row.winPct != null ? formatPct(row.winPct) : "—"}
          className={
            row.winPct != null ? perfToneClass(winScale.tone) : undefined
          }
          ariaLabel={row.winPct != null ? winScale.ariaLabel : undefined}
        />
        <MobileStat
          label="ROI"
          value={row.roi != null ? formatRoi(row.roi) : "—"}
          className={row.roi != null ? perfToneClass(roiScale.tone) : undefined}
          ariaLabel={row.roi != null ? roiScale.ariaLabel : undefined}
        />
        <MobileStat
          label="Sample"
          value={`${row.settled.toLocaleString()} · ${formatUnits(row.unitsRisked, true, false)} risked`}
          className="text-muted-foreground"
        />
      </dl>
    </article>
  );
}

function MobileStat({
  label,
  value,
  className,
  ariaLabel,
}: {
  label: string;
  value: string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="scl-eyebrow text-[color:var(--scl-muted-data)]">
        {label}
      </dt>
      <dd
        className={cn(
          "scl-data text-foreground mt-0.5 text-sm font-semibold tabular-nums",
          className,
        )}
        aria-label={ariaLabel}
      >
        {value}
      </dd>
    </div>
  );
}
