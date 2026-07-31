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
 *
 * Mobile (< md): dense Rank list rows in one shell — no tall cards, no h-scroll.
 * Desktop (md+): dense Rank table unchanged.
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
  const cell = compact ? "px-1.5 py-1.5" : "px-2.5 py-2";
  /** Dedicated columns so Sample / Verified meters never collide. */
  const sampleCol = compact
    ? "w-[5.5rem] min-w-[5.5rem]"
    : "w-[6rem] min-w-[6rem]";
  const verifiedCol = compact
    ? "w-[6.75rem] min-w-[6.75rem]"
    : "w-[7.25rem] min-w-[7.25rem]";

  return (
    <div className={cn(className)}>
      <p className="sr-only">{caption}</p>

      {/* Dense Rank list on phones — one shell, hairline rows (~52px), full schema. */}
      <ul
        className="border-border divide-border divide-y overflow-hidden rounded-[var(--scl-radius-card)] border bg-[color:var(--scl-ink-800)] lg:hidden"
        aria-label={caption}
      >
        {cappers.map((capper, i) => (
          <RankBoardMobileRow
            key={capper.id}
            capper={capper}
            rank={i + 1}
            compact={compact}
          />
        ))}
      </ul>

      <div
        className={cn(
          "border-border hidden overflow-x-auto rounded-[var(--scl-radius-card)] border bg-[color:var(--scl-ink-800)] lg:block",
        )}
      >
        <table
          className={cn(
            "w-full border-collapse text-sm",
            compact ? "min-w-[36rem]" : "min-w-[48rem]",
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
              <th className={cn("scl-eyebrow text-right", sampleCol, cell)}>
                Sample
              </th>
              <th className={cn("scl-eyebrow text-right", verifiedCol, cell)}>
                Verified
              </th>
              <th className={cn(compact ? "w-6 px-1 py-1.5" : "w-8 px-1 py-2")}>
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {cappers.map((capper, i) => {
              const graded = capper.settledPicks ?? 0;
              // Rank follows this board's order (parent already sorted).
              const rank = i + 1;
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
                  className="border-border relative min-h-14 border-b last:border-b-0 hover:bg-[color:var(--scl-ink-700)]/80"
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
                      className="focus-visible:ring-ring flex min-w-0 items-center gap-2 rounded-sm after:absolute after:inset-0 after:z-[1] after:content-[''] focus-visible:ring-2 focus-visible:outline-none"
                      aria-label={`Open ${capper.handle} profile`}
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
                          <span className="text-muted-foreground mt-0.5 block truncate text-xs leading-snug tracking-normal normal-case">
                            {specialty}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </td>
                  <td className={cn(cell, "align-middle")}>
                    <div className="flex max-w-[6.5rem] flex-wrap items-center gap-1">
                      {sports.map((sport) => (
                        <SportTag key={sport} sport={sport} markOnly />
                      ))}
                    </div>
                  </td>
                  <td
                    className={cn(
                      // nowrap keeps W-L-P atomic: a four-digit carried-over
                      // record (1714-1569-12) otherwise breaks at its hyphens
                      // into three lines and inflates every row's height.
                      "scl-data text-right align-middle whitespace-nowrap tabular-nums",
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
                  <td className={cn(cell, sampleCol, "align-middle")}>
                    <div className="ml-auto w-full max-w-full">
                      <SampleMaturityMeter graded={graded} compact />
                    </div>
                  </td>
                  <td className={cn(cell, verifiedCol, "align-middle")}>
                    <div className="ml-auto w-full max-w-full">
                      <VerifiedShareMeter pct={capper.verifiedShare} compact />
                    </div>
                  </td>
                  <td
                    className={cn(
                      "pointer-events-none align-middle text-[color:var(--scl-muted-data)]",
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
    </div>
  );
}

/**
 * Compact Rank row for phones: identity + headline stats on one scan path.
 * Keeps Record / ROI / Units / Sample / Verified without tall multi-band cards.
 */
function RankBoardMobileRow({
  capper,
  rank,
  compact,
}: {
  capper: CapperSummary;
  rank: number;
  compact: boolean;
}) {
  const graded = capper.settledPicks ?? 0;
  const sports = (capper.sports?.length ? capper.sports : [capper.topSport])
    .filter(Boolean)
    .slice(0, compact ? 2 : 3);
  const roiScale = perfScale("roi", capper.roi, { gradedCount: graded });
  const unitsScale = perfScale("units", capper.units, { gradedCount: graded });

  return (
    <li>
      <Link
        href={`/cappers/${capper.handle}`}
        className={cn(
          "focus-visible:ring-ring flex min-h-10 items-center gap-2 px-2.5 py-1.5 focus-visible:ring-2 focus-visible:outline-none sm:min-h-12",
          compact ? "gap-1.5 px-2" : null,
        )}
        aria-label={`Open ${capper.handle} profile`}
      >
        <RankBadge rank={rank} settledPicks={graded} variant="ledger" />
        <CapperAvatar name={capper.name} src={capper.avatarUrl} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <CapperIdentityLabel
              capper={capper}
              compact
              verified={capper.verified}
              className="min-w-0 flex-1 basis-[8rem]"
            />
            {sports.map((sport) => (
              <SportTag
                key={sport}
                sport={sport}
                markOnly
                className="shrink-0"
              />
            ))}
          </span>
          <span className="text-muted-foreground mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.7rem] leading-tight">
            <span className="scl-data tabular-nums">
              {formatRecord(capper.record.w, capper.record.l, capper.record.p)}
            </span>
            <span aria-hidden className="text-border">
              ·
            </span>
            <span
              className={cn(
                "scl-data font-semibold tabular-nums",
                perfToneClass(roiScale.tone),
              )}
              title={roiScale.ariaLabel}
            >
              {formatRoi(capper.roi)}
            </span>
            <span aria-hidden className="text-border">
              ·
            </span>
            <span className="inline-flex w-[3.25rem] shrink-0 items-center">
              <SampleMaturityMeter graded={graded} compact />
            </span>
            <span className="inline-flex w-[3.5rem] shrink-0 items-center">
              <VerifiedShareMeter pct={capper.verifiedShare} compact />
            </span>
          </span>
        </span>
        <span
          className={cn(
            "scl-data shrink-0 text-right text-sm font-semibold tabular-nums",
            perfToneClass(unitsScale.tone),
          )}
          title={unitsScale.ariaLabel}
        >
          {formatUnits(capper.units)}
        </span>
        <ChevronRight
          className="size-3.5 shrink-0 text-[color:var(--scl-muted-data)]"
          aria-hidden
        />
      </Link>
    </li>
  );
}
