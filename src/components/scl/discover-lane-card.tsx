import Link from "next/link";

import { CapperAvatar } from "@/components/scl/capper-avatar";
import { CapperIdentityLabel } from "@/components/scl/capper-identity-label";
import { SportTag } from "@/components/scl/badges";
import { SampleMaturityMeter } from "@/components/scl/sample-maturity-meter";
import { VerifiedShareMeter } from "@/components/scl/verified-share-meter";
import { formatRoi, formatUnits } from "@/lib/format";
import { formatClvPts } from "@/lib/proof-receipt";
import type { DiscoverLaneEntry } from "@/lib/discover-lanes";
import { perfScale, perfToneClass } from "@/lib/perf-scale";
import { cn } from "@/lib/utils";

/**
 * Lane-aware Discover strip — primary metric changes per lane.
 * ROI/Units/CLV via perf-scale; pink verified meter; units never dollars.
 * Maturity + units tone follow the sample behind this lane's primary.
 */
export function DiscoverLaneCard({ entry }: { entry: DiscoverLaneEntry }) {
  const { capper, primaryKind, primaryValue, primaryLabel, gradedSample } =
    entry;
  const sampleForScale = gradedSample;

  const unitsScale = perfScale("units", capper.units, {
    gradedCount: sampleForScale,
  });

  let primaryDisplay = "—";
  let primaryClass = "text-muted-foreground";
  let primaryAria = `${primaryLabel} unavailable`;

  if (primaryKind === "roi" && primaryValue != null) {
    const scale = perfScale("roi", primaryValue, {
      gradedCount: sampleForScale,
    });
    primaryDisplay = formatRoi(primaryValue);
    primaryClass = perfToneClass(scale.tone);
    primaryAria = scale.ariaLabel;
  } else if (primaryKind === "clv" && primaryValue != null) {
    const scale = perfScale("clv", primaryValue, {
      gradedCount: sampleForScale,
    });
    primaryDisplay = formatClvPts(primaryValue);
    primaryClass = perfToneClass(scale.tone);
    primaryAria = `${scale.ariaLabel}. Closing Line Value is a pricing metric — submitted price versus market close — not a prediction.`;
  } else if (primaryKind === "verifiedShare" && primaryValue != null) {
    primaryDisplay = `${Math.round(primaryValue)}%`;
    primaryClass = "text-foreground";
    primaryAria = `${Math.round(primaryValue)} percent Odds-Verified`;
  }

  return (
    <Link
      href={`/cappers/${capper.handle}`}
      prefetch={false}
      className="hover:bg-surface-2/60 focus-visible:ring-ring flex flex-col gap-2.5 py-3 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <CapperAvatar name={capper.name} src={capper.avatarUrl} size="sm" />
        <div className="min-w-0">
          <CapperIdentityLabel
            capper={capper}
            compact
            verified={false}
            primaryClassName="text-sm"
          />
          <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
            <SportTag sport={capper.topSport} markOnly className="shrink-0" />
            {entry.contextLabel ? (
              <>
                <span aria-hidden className="text-border">
                  ·
                </span>
                <span className="truncate font-medium">
                  {entry.contextLabel}
                </span>
              </>
            ) : null}
            <span aria-hidden className="text-border">
              ·
            </span>
            <span className="scl-data tabular-nums">
              {gradedSample.toLocaleString()} graded
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-4">
        <VerifiedShareMeter pct={capper.verifiedShare} />
        <SampleMaturityMeter
          graded={sampleForScale}
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
        <div className="min-w-[5.5rem] text-right">
          <span
            className={cn(
              "scl-data block text-base font-bold tabular-nums",
              primaryClass,
            )}
            title={primaryAria}
            aria-label={primaryAria}
          >
            {primaryDisplay}
          </span>
          <span className="text-muted-foreground text-[0.7rem] font-semibold tracking-wide uppercase">
            {primaryLabel}
          </span>
        </div>
      </div>
    </Link>
  );
}
