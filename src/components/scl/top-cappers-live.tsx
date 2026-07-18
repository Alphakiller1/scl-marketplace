import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";

import { CapperAvatar } from "@/components/scl/capper-avatar";
import { CapperIdentityLabel } from "@/components/scl/capper-identity-label";
import { SportTag } from "@/components/scl/badges";
import { RankBadge } from "@/components/scl/rank-badge";
import { SampleMaturityMeter } from "@/components/scl/sample-maturity-meter";
import { EmptyState } from "@/components/scl/states";
import { VerifiedShareMeter } from "@/components/scl/verified-share-meter";
import { formatRecord, formatRoi, formatUnits } from "@/lib/format";
import type { CapperSummary } from "@/lib/mock";
import { perfScale, perfToneClass } from "@/lib/perf-scale";
import { cn } from "@/lib/utils";

/**
 * Live Top Cappers — compact rows reusing PR-1 meters + perf-scale.
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
            Ranked by units in this verified scope
          </p>
        </div>
        <Link
          href="/cappers"
          className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-[color:var(--scl-blue)] hover:underline"
        >
          Browse directory
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      {!cappers.length ? (
        <EmptyState
          icon={Users}
          title={
            failed ? "Couldn't load top cappers" : "Top cappers are building"
          }
          description="No capper has enough graded volume to surface here yet. SCL only ranks after a minimum sample."
        />
      ) : (
        <ul className="border-border bg-card divide-border divide-y overflow-hidden rounded-[14px] border">
          {cappers.map((capper, index) => {
            const graded = capper.settledPicks ?? 0;
            const place = capper.rank || index + 1;
            const roiScale = perfScale("roi", capper.roi, {
              gradedCount: graded,
            });
            const unitsScale = perfScale("units", capper.units, {
              gradedCount: graded,
            });
            return (
              <li key={capper.id}>
                <Link
                  href={`/cappers/${capper.handle}`}
                  className="hover:bg-surface-2 focus-visible:ring-ring flex flex-col gap-3 px-3 py-3 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <RankBadge
                      rank={place}
                      settledPicks={graded}
                      className="size-9"
                    />
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
                          {formatRecord(
                            capper.record.w,
                            capper.record.l,
                            capper.record.p,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-4">
                    <span
                      className={cn(
                        "scl-data text-sm font-semibold tabular-nums",
                        perfToneClass(roiScale.tone),
                      )}
                      title={roiScale.ariaLabel}
                    >
                      {formatRoi(capper.roi)}
                    </span>
                    <span
                      className={cn(
                        "scl-data text-sm font-bold tabular-nums",
                        perfToneClass(unitsScale.tone),
                      )}
                      title={unitsScale.ariaLabel}
                    >
                      {formatUnits(capper.units)}
                    </span>
                    <SampleMaturityMeter
                      graded={graded}
                      compact
                      className="w-[4.5rem]"
                    />
                    <VerifiedShareMeter pct={capper.verifiedShare} />
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
