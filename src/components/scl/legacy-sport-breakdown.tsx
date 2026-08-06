import { History } from "lucide-react";

import { SportTag } from "@/components/scl/badges";
import { formatPct, formatRecord, formatRoi, formatUnits } from "@/lib/format";
import type { LegacySportRecordView } from "@/lib/legacy-sport-records";
import { perfScale, perfToneClass } from "@/lib/perf-scale";
import { cn } from "@/lib/utils";

/**
 * Per-sport carried-over totals from the previous SCL platform.
 * Sorted by units (then ROI). Totals only — no per-pick evidence.
 */
export function LegacySportBreakdown({
  records,
  className,
}: {
  records: LegacySportRecordView[];
  className?: string;
}) {
  if (records.length === 0) return null;

  const totalSettled = records.reduce((sum, row) => sum + row.settled, 0);

  return (
    <section
      data-profile-legacy-sports
      aria-label="Legacy record by sport"
      className={cn("border-border min-w-0 border-b pb-5", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-[color:var(--scl-blue)]/20 text-[color:var(--scl-blue)] ring-1 ring-[color:var(--scl-blue)]/35">
              <History className="size-3" aria-hidden />
            </span>
            <h2 className="scl-display text-base font-bold tracking-[0.04em]">
              Legacy by sport
            </h2>
          </div>
          <p className="text-muted-foreground mt-1 max-w-2xl text-xs leading-relaxed">
            Settled results carried over from the previous SCL platform — totals
            only, no per-pick record. Sorted by units. These figures are already
            folded into the Evidence Brief above.
          </p>
        </div>
        <p className="scl-data text-muted-foreground text-xs tabular-nums">
          {records.length} sport{records.length === 1 ? "" : "s"} ·{" "}
          {totalSettled.toLocaleString()} settled
        </p>
      </div>

      <div className="mt-4 hidden md:block">
        <table className="w-full table-fixed border-collapse">
          <caption className="sr-only">
            Legacy carried-over record broken down by sport, sorted by units
          </caption>
          <thead>
            <tr className="border-border border-y">
              {(
                ["Sport", "Record", "Win%", "ROI", "Units", "Sample"] as const
              ).map((label) => (
                <th
                  key={label}
                  scope="col"
                  className={cn(
                    "scl-eyebrow px-2 py-2.5 text-[color:var(--scl-muted-data)] first:pl-0 last:pr-0",
                    label === "Sport" ? "text-left" : "text-right",
                  )}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((row) => (
              <LegacySportDesktopRow key={row.sport} row={row} />
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-border mt-3 divide-y md:hidden">
        {records.map((row) => (
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

  return (
    <tr className="border-border border-b last:border-b-0">
      <td className="py-3 pr-2 pl-0 align-middle">
        <SportTag sport={row.sport} forceLabel />
      </td>
      <td className="scl-data px-2 py-3 text-right text-sm font-semibold tabular-nums">
        {formatRecord(row.wins, row.losses, row.pushes)}
      </td>
      <td
        className={cn(
          "scl-data px-2 py-3 text-right text-sm font-semibold tabular-nums",
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
          "scl-data px-2 py-3 text-right text-sm font-semibold tabular-nums",
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
          "scl-data px-2 py-3 text-right text-sm font-semibold tabular-nums",
          perfToneClass(unitsScale.tone),
        )}
        aria-label={unitsScale.ariaLabel}
      >
        {formatUnits(row.units)}
      </td>
      <td className="scl-data text-muted-foreground py-3 pr-0 pl-2 text-right text-sm tabular-nums">
        {row.settled.toLocaleString()}
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

  return (
    <article className="min-w-0">
      <div className="flex items-center justify-between gap-3">
        <SportTag sport={row.sport} forceLabel />
        <p
          className={cn(
            "scl-data text-sm font-semibold tabular-nums",
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
          value={row.settled.toLocaleString()}
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
