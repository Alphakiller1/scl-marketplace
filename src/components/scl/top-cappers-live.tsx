import Link from "next/link";
import { ArrowRight, ChevronRight, Trophy, Users } from "lucide-react";

import { CapperAvatar } from "@/components/scl/capper-avatar";
import { CapperIdentityLabel } from "@/components/scl/capper-identity-label";
import { SportTag } from "@/components/scl/badges";
import { SampleMaturityMeter } from "@/components/scl/sample-maturity-meter";
import { EmptyState } from "@/components/scl/states";
import { VerifiedShareMeter } from "@/components/scl/verified-share-meter";
import { formatRecord, formatRoi, formatUnits } from "@/lib/format";
import type { CapperSummary } from "@/lib/mock";
import { perfScale, perfToneClass } from "@/lib/perf-scale";
import { cn } from "@/lib/utils";

const WINDOW_CHIPS = [
  { id: "7d", label: "7D", href: "/leaderboard?window=7d&sort=roi" },
  { id: "30d", label: "30D", href: "/leaderboard?window=30d&sort=roi" },
  { id: "90d", label: "90D", href: "/leaderboard?window=90d&sort=roi" },
  { id: "all", label: "ALL", href: "/leaderboard?window=all&sort=roi" },
] as const;

/**
 * Mockup-faithful Top Cappers — dense ranked table (no soft list cards).
 * Money column = units only (no dollar handle). Sports = compact marks.
 */
export function TopCappersLive({
  cappers,
  failed = false,
  activeWindow = "30d",
  className,
}: {
  cappers: CapperSummary[];
  failed?: boolean;
  activeWindow?: (typeof WINDOW_CHIPS)[number]["id"];
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)} aria-label="Top cappers">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 border-t border-[color:var(--scl-pink-deep)] pt-2.5">
            <Trophy
              className="size-4 text-[color:var(--scl-pink)]"
              aria-hidden
            />
            <h2 className="scl-display text-[1.375rem] leading-7 font-semibold tracking-[0.04em] uppercase">
              Top cappers
            </h2>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Ranked by board-verified share, then units.
          </p>
        </div>
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Ranking window"
        >
          {WINDOW_CHIPS.map((chip) => {
            const active = chip.id === activeWindow;
            return (
              <Link
                key={chip.id}
                href={chip.href}
                className={cn(
                  "scl-data inline-flex h-8 min-w-9 items-center justify-center rounded-[var(--scl-radius-chip)] px-2 text-[10px] font-semibold tracking-[0.1em] uppercase transition-colors",
                  active
                    ? "bg-[color:var(--scl-blue)] text-[color:var(--scl-blue-ink)]"
                    : "border-border text-muted-foreground hover:text-foreground border bg-transparent",
                )}
                aria-current={active ? "page" : undefined}
              >
                {chip.label}
              </Link>
            );
          })}
        </div>
      </div>

      {!cappers.length ? (
        <EmptyState
          icon={Users}
          title={
            failed ? "Couldn't load top cappers" : "No cappers qualify yet"
          }
          description="No capper has reached the minimum graded sample for this list."
        />
      ) : (
        <>
          <div className="border-border overflow-x-auto border-y">
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <thead>
                <tr className="border-border border-b">
                  <th className="scl-eyebrow text-muted-foreground px-2 py-2 text-left font-medium">
                    Rank
                  </th>
                  <th className="scl-eyebrow text-muted-foreground px-2 py-2 text-left font-medium">
                    Capper
                  </th>
                  <th className="scl-eyebrow text-muted-foreground px-2 py-2 text-left font-medium">
                    Sports
                  </th>
                  <th className="scl-eyebrow text-muted-foreground px-2 py-2 text-right font-medium">
                    Record
                  </th>
                  <th className="scl-eyebrow text-muted-foreground px-2 py-2 text-right font-medium">
                    ROI
                  </th>
                  <th className="scl-eyebrow text-muted-foreground px-2 py-2 text-right font-medium">
                    Units
                  </th>
                  <th className="scl-eyebrow text-muted-foreground px-2 py-2 text-right font-medium">
                    Sample
                  </th>
                  <th className="scl-eyebrow text-muted-foreground px-2 py-2 text-right font-medium">
                    Verified
                  </th>
                  <th className="w-8 px-1 py-2">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {cappers.map((capper, i) => {
                  const graded = capper.settledPicks ?? 0;
                  const roiScale = perfScale("roi", capper.roi, {
                    gradedCount: graded,
                  });
                  const unitsScale = perfScale("units", capper.units, {
                    gradedCount: graded,
                  });
                  const sports = (
                    capper.sports?.length ? capper.sports : [capper.topSport]
                  )
                    .filter(Boolean)
                    .slice(0, 3);

                  return (
                    <tr
                      key={capper.id}
                      className="border-border hover:bg-surface-2/50 border-b last:border-b-0"
                    >
                      <td className="scl-data px-2 py-1.5 tabular-nums">
                        {capper.rank > 0 ? capper.rank : i + 1}
                      </td>
                      <td className="px-2 py-1.5">
                        <Link
                          href={`/cappers/${capper.handle}`}
                          className="focus-visible:ring-ring flex min-w-0 items-center gap-2 rounded-sm focus-visible:ring-2 focus-visible:outline-none"
                        >
                          <CapperAvatar
                            name={capper.name}
                            src={capper.avatarUrl}
                            size="sm"
                          />
                          <CapperIdentityLabel
                            capper={capper}
                            compact
                            verified={capper.verified}
                            primaryClassName="text-sm"
                          />
                        </Link>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1">
                          {sports.map((sport) => (
                            <SportTag
                              key={sport}
                              sport={sport}
                              markOnly
                              className="size-6 shrink-0 [&_img]:size-3.5"
                            />
                          ))}
                        </div>
                      </td>
                      <td className="scl-data px-2 py-1.5 text-right tabular-nums">
                        {formatRecord(
                          capper.record.w,
                          capper.record.l,
                          capper.record.p,
                        )}
                      </td>
                      <td
                        className={cn(
                          "scl-data px-2 py-1.5 text-right font-semibold tabular-nums",
                          perfToneClass(roiScale.tone),
                        )}
                        title={roiScale.ariaLabel}
                      >
                        {formatRoi(capper.roi)}
                      </td>
                      <td
                        className={cn(
                          "scl-data px-2 py-1.5 text-right font-semibold tabular-nums",
                          perfToneClass(unitsScale.tone),
                        )}
                        title={unitsScale.ariaLabel}
                      >
                        {formatUnits(capper.units)}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="ml-auto w-[4.75rem]">
                          <SampleMaturityMeter graded={graded} compact />
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="ml-auto w-[4.75rem]">
                          <VerifiedShareMeter pct={capper.verifiedShare} />
                        </div>
                      </td>
                      <td className="px-1 py-1.5 text-[color:var(--scl-muted-data)]">
                        <ChevronRight className="size-4" aria-hidden />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Link
            href="/leaderboard"
            className="scl-link inline-flex min-h-11 items-center gap-1 text-sm font-medium"
          >
            View full leaderboard
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </>
      )}
    </section>
  );
}
