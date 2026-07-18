import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";

import { CapperAvatar } from "@/components/scl/capper-avatar";
import { CapperIdentityLabel } from "@/components/scl/capper-identity-label";
import { SportTag } from "@/components/scl/badges";
import { SampleMaturityMeter } from "@/components/scl/sample-maturity-meter";
import { EmptyState } from "@/components/scl/states";
import { VerifiedShareMeter } from "@/components/scl/verified-share-meter";
import { formatUnits } from "@/lib/format";
import type { CapperSummary } from "@/lib/mock";
import { perfScale, perfToneClass } from "@/lib/perf-scale";
import { cn } from "@/lib/utils";

/**
 * Live Top Cappers — who is worth inspecting (verified share primary).
 * Distinct from Leaderboard snapshot (board place by units).
 * Units remain the only money metric — no dollar handle.
 */
export function TopCappersLive({
  cappers,
  failed = false,
  className,
}: {
  cappers: CapperSummary[];
  failed?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)} aria-label="Top cappers">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 border-t border-[color:var(--scl-pink-deep)] pt-2.5">
          <h2 className="scl-display text-lg font-semibold tracking-[0.04em]">
            Top cappers
          </h2>
          <p className="text-muted-foreground text-sm">
            Ordered by board-verified share, then units.
          </p>
        </div>
        <Link
          href="/discover"
          className="scl-link inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium"
        >
          Discover
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
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
        <ul className="divide-border border-border divide-y border-y">
          {cappers.map((capper) => {
            const graded = capper.settledPicks ?? 0;
            const unitsScale = perfScale("units", capper.units, {
              gradedCount: graded,
            });
            return (
              <li key={capper.id}>
                <Link
                  href={`/cappers/${capper.handle}`}
                  className="hover:bg-surface-2/60 focus-visible:ring-ring flex flex-col gap-2.5 py-3 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <CapperAvatar
                      name={capper.name}
                      src={capper.avatarUrl}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <CapperIdentityLabel
                        capper={capper}
                        compact
                        verified={false}
                        primaryClassName="text-sm"
                      />
                      <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                        <SportTag
                          sport={capper.topSport}
                          markOnly
                          className="shrink-0"
                        />
                        <span aria-hidden className="text-border">
                          ·
                        </span>
                        <span className="scl-data tabular-nums">
                          {graded} graded
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-4">
                    <VerifiedShareMeter pct={capper.verifiedShare} />
                    <SampleMaturityMeter
                      graded={graded}
                      compact
                      className="w-[4.5rem]"
                    />
                    <span
                      className={cn(
                        "scl-data text-sm font-bold tabular-nums",
                        perfToneClass(unitsScale.tone),
                      )}
                      title={unitsScale.ariaLabel}
                    >
                      {formatUnits(capper.units)}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
