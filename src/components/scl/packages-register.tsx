"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Search, ShieldCheck } from "lucide-react";

const PACKAGES_PAGE_SIZE = 20;

import { CapperAvatar } from "@/components/scl/capper-avatar";
import { ProviderBadge } from "@/components/scl/provider-badge";
import { SampleMaturityMeter } from "@/components/scl/sample-maturity-meter";
import { Button } from "@/components/ui/button";
import { formatRecord, formatRoi, formatUnits } from "@/lib/format";
import type { CapperSummary } from "@/lib/mock";
import type { PackageEvidence } from "@/lib/package-register";
import {
  findMarketplaceCapperMatches,
  type PublicMarketplaceCapper,
} from "@/lib/marketplace-search";
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

  if (!evidence || evidence.settledPicks === 0) {
    return (
      <div>
        <p className="text-sm font-semibold">No attributed picks yet</p>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          This offer has no graded picks explicitly linked to it. The capper’s
          overall public record remains available on their profile.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 lg:grid-cols-4 lg:items-end">
        <EvidenceMetric label="Record" evidence={evidence} />
        <EvidenceMetric label="ROI" evidence={evidence} />
        <EvidenceMetric label="Units" evidence={evidence} />
        <div className="min-w-0">
          <p className="scl-eyebrow text-[color:var(--scl-muted-data)]">
            Sample
          </p>
          <SampleMaturityMeter
            graded={evidence?.settledPicks ?? 0}
            compact
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
  const publicRecord =
    row.capper && (row.capper.settledPicks ?? 0) > 0
      ? `${formatRecord(
          row.capper.record.w,
          row.capper.record.l,
          row.capper.record.p,
        )} · ${formatRoi(row.capper.roi)} ROI`
      : "Open public capper profile";
  return (
    <Link
      href={`/cappers/${row.pkg.capperHandle}`}
      prefetch={false}
      className="focus-visible:ring-ring group inline-flex min-h-10 min-w-0 items-center gap-2 rounded-sm focus-visible:ring-2 focus-visible:outline-none"
    >
      <CapperAvatar name={name} src={row.capper?.avatarUrl} size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold underline-offset-4 group-hover:underline">
          @{row.pkg.capperHandle.replace(/^@/, "")}
        </span>
        <span className="text-muted-foreground block text-xs">
          {publicRecord}
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
          {pkg.priceLabel ?? "See provider for current price"}
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
  searchCappers,
  cappers,
  packageEvidence,
  evidenceFailed = false,
}: {
  packages: PublicMarketplacePackage[];
  searchCappers: PublicMarketplaceCapper[];
  cappers: CapperSummary[];
  packageEvidence: Record<string, PackageEvidence | null>;
  evidenceFailed?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"featured" | "name" | "units" | "roi">(
    "units",
  );
  const [visibleCount, setVisibleCount] = useState(PACKAGES_PAGE_SIZE);
  const rows = useMemo(() => {
    const cappersById = new Map(cappers.map((capper) => [capper.id, capper]));
    const normalized = query.trim().toLowerCase().replace(/^@/, "");
    const next: RegisterRow[] = packages
      .map((pkg) => ({
        pkg,
        capper: cappersById.get(pkg.capperId) ?? null,
        evidence: packageEvidence[pkg.id] ?? null,
      }))
      .filter((row) => {
        if (!normalized) return true;
        return [row.pkg.capperHandle, row.pkg.capperName, row.pkg.title].some(
          (value) => value.toLowerCase().includes(normalized),
        );
      });

    if (sort === "name") {
      next.sort((a, b) => a.pkg.capperHandle.localeCompare(b.pkg.capperHandle));
    } else if (sort === "units") {
      next.sort(
        (a, b) =>
          (b.evidence?.units ?? Number.NEGATIVE_INFINITY) -
          (a.evidence?.units ?? Number.NEGATIVE_INFINITY),
      );
    } else if (sort === "roi") {
      next.sort(
        (a, b) =>
          (b.evidence?.roi ?? Number.NEGATIVE_INFINITY) -
          (a.evidence?.roi ?? Number.NEGATIVE_INFINITY),
      );
    }
    return next;
  }, [cappers, packageEvidence, packages, query, sort]);
  const profileMatches = useMemo(
    () =>
      findMarketplaceCapperMatches(
        query,
        searchCappers,
        new Set(packages.map((pkg) => pkg.capperId)),
      ),
    [packages, query, searchCappers],
  );

  // Reset the page window when filters change so search/sort never hide hits
  // behind a prior "Show more" ceiling.
  const visibleRows = rows.slice(0, visibleCount);
  const hasMore = visibleCount < rows.length;

  return (
    <section className="border-border mt-6 border-y" aria-label="Public offers">
      <div className="bg-surface-2 border-border flex flex-col gap-3 border-b px-3 py-3 sm:px-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck
            className="size-4 text-[color:var(--scl-pink)]"
            aria-hidden
          />
          <p className="text-sm font-semibold">
            {rows.length} public offer{rows.length === 1 ? "" : "s"}
            {profileMatches.length > 0 ? (
              <span className="text-muted-foreground font-normal">
                {" "}
                · {profileMatches.length} capper profile
                {profileMatches.length === 1 ? "" : "s"}
              </span>
            ) : null}
            {hasMore ? (
              <span className="text-muted-foreground font-normal">
                {" "}
                · showing {visibleRows.length}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="min-w-0">
            <span className="scl-eyebrow mb-1 block">
              Find a capper or offer
            </span>
            <span className="border-input bg-background flex min-h-10 items-center gap-2 rounded-md border px-3">
              <Search className="text-muted-foreground size-4" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setVisibleCount(PACKAGES_PAGE_SIZE);
                }}
                placeholder="Search cappers"
                className="min-w-0 bg-transparent text-base outline-none sm:w-48 sm:text-sm"
              />
            </span>
          </label>
          <label>
            <span className="scl-eyebrow mb-1 block">Sort</span>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as typeof sort);
                setVisibleCount(PACKAGES_PAGE_SIZE);
              }}
              className="border-input bg-background min-h-10 rounded-md border px-3 text-base sm:text-sm"
            >
              <option value="units">Attributed units</option>
              <option value="roi">Attributed ROI</option>
              <option value="name">Capper name</option>
              <option value="featured">Featured order</option>
            </select>
          </label>
        </div>
      </div>

      {profileMatches.length > 0 ? (
        <div className="border-border bg-background border-b px-3 py-4 sm:px-4">
          <h2 className="scl-eyebrow text-[color:var(--scl-muted-data)]">
            Capper profiles matching your search
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {profileMatches.map((capper) => (
              <li key={capper.id}>
                <Link
                  href={`/cappers/${capper.handle}`}
                  prefetch={false}
                  className="border-border focus-visible:ring-ring group flex min-h-16 items-center gap-3 rounded-md border px-3 py-2.5 focus-visible:ring-2 focus-visible:outline-none"
                >
                  <CapperAvatar
                    name={capper.name}
                    src={capper.avatarUrl ?? undefined}
                    size="sm"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold underline-offset-4 group-hover:underline">
                      @{capper.handle.replace(/^@/, "")}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      No public offers yet · View public profile
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {rows.length === 0 && profileMatches.length === 0 ? (
        <p className="text-muted-foreground px-4 py-10 text-center text-sm">
          No public offers match this search.
        </p>
      ) : (
        <>
          <div className="hidden lg:block">
            <table className="w-full table-fixed border-collapse">
              <caption className="sr-only">
                Active external offers with performance from picks attributed to
                each package
              </caption>
              <colgroup>
                <col className="w-[16%]" />
                <col className="w-[44%]" />
                <col className="w-[25%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead>
                <tr className="border-border bg-background border-b">
                  {[
                    "Capper",
                    "Attributed package record",
                    "Offer",
                    "External storefront",
                  ].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="scl-eyebrow px-3 py-3 text-left text-[color:var(--scl-muted-data)] first:pl-4 last:pr-4"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
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
            {visibleRows.map((row) => (
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

          {hasMore ? (
            <div className="border-border flex justify-center border-t px-4 py-5">
              <Button
                type="button"
                variant="outline"
                className="min-h-10"
                onClick={() =>
                  setVisibleCount((count) => count + PACKAGES_PAGE_SIZE)
                }
              >
                Show more offers
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
