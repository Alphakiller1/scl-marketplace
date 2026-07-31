import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";

import { CapperAvatar } from "@/components/scl/capper-avatar";
import { ProviderBadge } from "@/components/scl/provider-badge";
import { SampleMaturityMeter } from "@/components/scl/sample-maturity-meter";
import { VerifiedShareMeter } from "@/components/scl/verified-share-meter";
import { Button } from "@/components/ui/button";
import { formatRecord, formatRoi, formatUnits } from "@/lib/format";
import type { CapperSummary } from "@/lib/mock";
import {
  indexPackageEvidence,
  type PackageEvidence,
} from "@/lib/package-register";
import { perfScale, perfToneClass } from "@/lib/perf-scale";
import type { PublicMarketplacePackage } from "@/lib/queries/store";
import { packageCtaLabel } from "@/lib/store-connection";
import { cn } from "@/lib/utils";

type RegisterRow = {
  pkg: PublicMarketplacePackage;
  capper: CapperSummary | null;
  evidence: PackageEvidence | null;
};

function metricValue(
  label: "Record" | "ROI" | "Units",
  evidence: PackageEvidence | null,
): { value: string; className?: string; ariaLabel?: string } {
  if (!evidence) return { value: "—" };

  if (label === "Record") {
    return {
      value: evidence.record
        ? formatRecord(evidence.record.w, evidence.record.l, evidence.record.p)
        : "—",
    };
  }

  const value = label === "ROI" ? evidence.roi : evidence.units;
  if (value == null) return { value: "—" };
  const metric = label === "ROI" ? "roi" : "units";
  const scale = perfScale(metric, value, {
    gradedCount: evidence.settledPicks,
  });
  return {
    value: label === "ROI" ? formatRoi(value) : formatUnits(value),
    className: perfToneClass(scale.tone),
    ariaLabel: scale.ariaLabel,
  };
}

function EvidenceMetric({
  label,
  evidence,
}: {
  label: "Record" | "ROI" | "Units";
  evidence: PackageEvidence | null;
}) {
  const metric = metricValue(label, evidence);
  return (
    <div className="min-w-0">
      <p className="scl-eyebrow text-[color:var(--scl-muted-data)]">{label}</p>
      <p
        className={cn(
          "scl-data text-foreground mt-1 truncate text-sm font-semibold tabular-nums",
          metric.className,
        )}
        aria-label={metric.ariaLabel}
      >
        {metric.value}
      </p>
    </div>
  );
}

function EvidenceStrip({
  evidence,
  unavailable = false,
}: {
  evidence: PackageEvidence | null;
  unavailable?: boolean;
}) {
  if (unavailable) {
    return (
      <p className="text-muted-foreground text-sm leading-relaxed">
        Public record temporarily unavailable.
      </p>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-x-3 gap-y-4 lg:grid-cols-[0.75fr_0.75fr_0.75fr_1.35fr_1.2fr] lg:items-end">
        <EvidenceMetric label="Record" evidence={evidence} />
        <EvidenceMetric label="ROI" evidence={evidence} />
        <EvidenceMetric label="Units" evidence={evidence} />
        <div className="col-span-2 min-w-0 lg:col-span-1">
          <p className="scl-eyebrow text-[color:var(--scl-muted-data)]">
            Sample
          </p>
          <SampleMaturityMeter
            graded={evidence?.settledPicks ?? 0}
            compact
            className="mt-1 justify-start"
          />
        </div>
        <div className="min-w-0">
          <p className="scl-eyebrow text-[color:var(--scl-muted-data)]">
            Verified
          </p>
          <VerifiedShareMeter
            pct={evidence?.verifiedShare}
            showZero={Boolean(evidence && evidence.settledPicks > 0)}
            className="mt-1 justify-start"
          />
        </div>
      </div>
      {evidence?.provisional ? (
        <p className="mt-2 text-xs leading-relaxed text-[color:var(--scl-perf-mid-text)]">
          Provisional — early sample.
        </p>
      ) : null}
    </div>
  );
}

function CapperCell({ row }: { row: RegisterRow }) {
  const name = row.capper?.name || row.pkg.capperName;
  return (
    <Link
      href={`/cappers/${row.pkg.capperHandle}`}
      className="focus-visible:ring-ring group inline-flex min-h-10 min-w-0 items-center gap-2 rounded-sm focus-visible:ring-2 focus-visible:outline-none"
    >
      <CapperAvatar name={name} src={row.capper?.avatarUrl} size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold underline-offset-4 group-hover:underline">
          @{row.pkg.capperHandle.replace(/^@/, "")}
        </span>
        <span className="text-muted-foreground block text-xs">
          Inspect public record
        </span>
      </span>
    </Link>
  );
}

function OfferDetails({ pkg }: { pkg: PublicMarketplacePackage }) {
  return (
    <div className="min-w-0">
      <h2 className="scl-display text-foreground text-base font-semibold">
        {pkg.title}
      </h2>
      {pkg.description ? (
        <p className="text-muted-foreground mt-1 line-clamp-2 text-sm leading-relaxed">
          {pkg.description}
        </p>
      ) : null}
      {pkg.promoOffer ? (
        <p className="mt-2 text-xs font-semibold text-[color:var(--scl-pink-text)]">
          {pkg.promoOffer}
        </p>
      ) : null}
    </div>
  );
}

function ExternalStorefront({ pkg }: { pkg: PublicMarketplacePackage }) {
  return (
    <div className="flex flex-col items-start gap-2 lg:items-end">
      {pkg.provider ? <ProviderBadge provider={pkg.provider} /> : null}
      <div className="min-h-5">
        <p className="scl-eyebrow text-[color:var(--scl-muted-data)]">
          External price
        </p>
        <p className="nums text-foreground mt-0.5 text-sm font-semibold tabular-nums">
          {pkg.priceLabel ?? "Shown by provider"}
        </p>
      </div>
      <Button
        render={
          <Link
            href={pkg.trackingPath}
            target="_blank"
            rel="noopener noreferrer"
            // /go/[slug] writes a ClickEvent on every GET, so prefetching it
            // records a click nobody made. Next prefetches links on hover and
            // in-viewport by default, which silently inflated the count for
            // every offer rendered on the page.
            prefetch={false}
          />
        }
        nativeButton={false}
        variant="outline"
        className="min-h-10 gap-1.5"
      >
        {packageCtaLabel(pkg.provider)}
        <ArrowUpRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

export function PackagesRegister({
  packages,
  cappers,
  evidenceFailed = false,
}: {
  packages: PublicMarketplacePackage[];
  cappers: CapperSummary[];
  evidenceFailed?: boolean;
}) {
  const cappersById = new Map(cappers.map((capper) => [capper.id, capper]));
  const evidenceById = indexPackageEvidence(cappers);
  const rows: RegisterRow[] = packages.map((pkg) => ({
    pkg,
    capper: cappersById.get(pkg.capperId) ?? null,
    evidence: evidenceById.get(pkg.capperId) ?? null,
  }));

  return (
    <section className="border-border mt-6 border-y" aria-label="Public offers">
      <div className="bg-surface-2 border-border flex flex-col gap-2 border-b px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex items-center gap-2">
          <ShieldCheck
            className="size-4 text-[color:var(--scl-pink)]"
            aria-hidden
          />
          <p className="text-sm font-semibold">
            {rows.length} public offer{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Evidence scope: all-time public record
        </p>
      </div>

      <div className="hidden lg:block">
        <table className="w-full table-fixed border-collapse">
          <caption className="sr-only">
            Active external offers with each capper&apos;s all-time public
            evidence
          </caption>
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[44%]" />
            <col className="w-[25%]" />
            <col className="w-[15%]" />
          </colgroup>
          <thead>
            <tr className="border-border bg-background border-b">
              {["Capper", "Public record", "Offer", "External storefront"].map(
                (label) => (
                  <th
                    key={label}
                    scope="col"
                    className="scl-eyebrow px-3 py-3 text-left text-[color:var(--scl-muted-data)] first:pl-4 last:pr-4"
                  >
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.pkg.id}
                className="border-border border-b last:border-b-0"
              >
                <td className="px-3 py-5 pl-4 align-top">
                  <CapperCell row={row} />
                </td>
                <td className="px-3 py-5 align-top">
                  <EvidenceStrip
                    evidence={row.evidence}
                    unavailable={evidenceFailed}
                  />
                </td>
                <td className="px-3 py-5 align-top">
                  <OfferDetails pkg={row.pkg} />
                </td>
                <td className="px-3 py-5 pr-4 align-top">
                  <ExternalStorefront pkg={row.pkg} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-border divide-y lg:hidden">
        {rows.map((row) => (
          <article key={row.pkg.id} className="px-3 py-5 sm:px-4">
            <CapperCell row={row} />
            <div className="border-border mt-4 border-y py-4">
              <EvidenceStrip
                evidence={row.evidence}
                unavailable={evidenceFailed}
              />
            </div>
            <div className="mt-4">
              <OfferDetails pkg={row.pkg} />
            </div>
            <div className="mt-4">
              <ExternalStorefront pkg={row.pkg} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
