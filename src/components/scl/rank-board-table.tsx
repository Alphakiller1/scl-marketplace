import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { CapperAvatar } from "@/components/scl/capper-avatar";
import { CapperIdentityLabel } from "@/components/scl/capper-identity-label";
import { SportTag } from "@/components/scl/badges";
import { RankBadge } from "@/components/scl/rank-badge";
import { SampleMaturityMeter } from "@/components/scl/sample-maturity-meter";
import { VerifiedShareMeter } from "@/components/scl/verified-share-meter";
import { formatRecord, formatRoi, formatUnits } from "@/lib/format";
import type { CapperSummary } from "@/lib/mock";
import { perfScale, perfToneClass } from "@/lib/perf-scale";
import { cn } from "@/lib/utils";

/**
 * Single Rank-schema body for home boards.
 * Columns: Rank · Capper · Sports · Record · ROI · Units · Sample · Verified
 * (no Handle $; Form lives on full /leaderboard only).
 *
 * density:
 * - snapshot — hero Live board (tighter cells, still full schema)
 * - live — Top Cappers body (standard ~56px craft density)
 */
export function RankBoardTable({
  cappers,
  density = "live",
  caption = "Ranked cappers",
  className,
}: {
  cappers: CapperSummary[];
  density?: "snapshot" | "live";
  caption?: string;
  className?: string;
}) {
  const compact = density === "snapshot";
  const cell = compact ? "px-1.5 py-1.5" : "px-2 py-1.5";
  const meterW = compact ? "w-[4.25rem]" : "w-[4.75rem]";

  return (
    <div
      className={cn(
        "border-border overflow-x-auto rounded-[var(--scl-radius-card)] border bg-[color:var(--scl-ink-800)]",
        className,
      )}
    >
      <table
        className={cn(
          "w-full border-collapse text-sm",
          compact ? "min-w-[32rem]" : "min-w-[44rem]",
        )}
      >
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-border border-b">
            <th className={cn("scl-eyebrow w-12 text-left", cell)}>Rank</th>
            <th
              className={cn(
                "scl-eyebrow text-left",
                compact ? "min-w-[8rem]" : "min-w-[9rem]",
                cell,
              )}
            >
              Capper
            </th>
            <th className={cn("scl-eyebrow text-left", cell)}>Sports</th>
            <th className={cn("scl-eyebrow text-right", cell)}>Record</th>
            <th className={cn("scl-eyebrow text-right", cell)}>ROI</th>
            <th className={cn("scl-eyebrow text-right", cell)}>Units</th>
            <th className={cn("scl-eyebrow text-right", cell)}>Sample</th>
            <th className={cn("scl-eyebrow text-right", cell)}>Verified</th>
            <th className={cn(compact ? "w-6 px-1 py-1.5" : "w-8 px-1 py-2")}>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {cappers.map((capper, i) => {
            const graded = capper.settledPicks ?? 0;
            const rank = capper.rank > 0 ? capper.rank : i + 1;
            const sports = (
              capper.sports?.length ? capper.sports : [capper.topSport]
            )
              .filter(Boolean)
              .slice(0, 3);
            const specialty =
              capper.specialties?.find((s) => s.trim().length > 0) ??
              (capper.topSport ? capper.topSport : null);
            const roiScale = perfScale("roi", capper.roi, {
              gradedCount: graded,
            });
            const unitsScale = perfScale("units", capper.units, {
              gradedCount: graded,
            });

            return (
              <tr
                key={capper.id}
                className="border-border h-14 border-b last:border-b-0 hover:bg-[color:var(--scl-ink-700)]/80"
              >
                <td className={cn(cell, "align-middle")}>
                  <RankBadge
                    rank={rank}
                    settledPicks={graded}
                    variant="ledger"
                  />
                </td>
                <td className={cn(cell, "align-middle")}>
                  <Link
                    href={`/cappers/${capper.handle}`}
                    className="focus-visible:ring-ring flex min-w-0 items-center gap-2 rounded-sm focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <CapperAvatar
                      name={capper.name}
                      src={capper.avatarUrl}
                      size="sm"
                    />
                    <span className="min-w-0">
                      <CapperIdentityLabel
                        capper={capper}
                        compact
                        verified={capper.verified}
                      />
                      {specialty ? (
                        <span className="scl-eyebrow text-muted-foreground mt-0.5 block truncate tracking-[0.04em] normal-case">
                          {specialty}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </td>
                <td className={cn(cell, "align-middle")}>
                  <div className="flex flex-nowrap items-center gap-1">
                    {sports.map((sport) => (
                      <SportTag key={sport} sport={sport} markOnly />
                    ))}
                  </div>
                </td>
                <td
                  className={cn(
                    "scl-data text-right align-middle tabular-nums",
                    cell,
                  )}
                >
                  {formatRecord(
                    capper.record.w,
                    capper.record.l,
                    capper.record.p,
                  )}
                </td>
                <td
                  className={cn(
                    "scl-data text-right align-middle font-semibold tabular-nums",
                    cell,
                    perfToneClass(roiScale.tone),
                  )}
                  title={roiScale.ariaLabel}
                >
                  {formatRoi(capper.roi)}
                </td>
                <td
                  className={cn(
                    "scl-data text-right align-middle font-semibold tabular-nums",
                    cell,
                    perfToneClass(unitsScale.tone),
                  )}
                  title={unitsScale.ariaLabel}
                >
                  {formatUnits(capper.units)}
                </td>
                <td className={cn(cell, "align-middle")}>
                  <div className={cn("ml-auto", meterW)}>
                    <SampleMaturityMeter graded={graded} compact />
                  </div>
                </td>
                <td className={cn(cell, "align-middle")}>
                  <div className={cn("ml-auto", meterW)}>
                    <VerifiedShareMeter pct={capper.verifiedShare} />
                  </div>
                </td>
                <td
                  className={cn(
                    "align-middle text-[color:var(--scl-muted-data)]",
                    compact ? "px-1 py-1.5" : "px-1 py-1.5",
                  )}
                >
                  <ChevronRight
                    className={compact ? "size-3.5" : "size-4"}
                    aria-hidden
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
