import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, PackageOpen, ShieldCheck } from "lucide-react";

import { PackagesRegister } from "@/components/scl/packages-register";
import { Button } from "@/components/ui/button";
import { STOREFRONT_PAYMENT_DISCLAIMER } from "@/lib/cold-start-copy";
import { getPublicCapperEvidenceByIds } from "@/lib/queries/leaderboard";
import { getPackagePerformanceEvidence } from "@/lib/queries/package-performance";
import {
  listActiveMarketplacePackagesResult,
  listPublicMarketplaceCappersResult,
} from "@/lib/queries/store";

export const metadata: Metadata = {
  title: "Packages",
  description:
    "Inspect public capper records alongside approved offers that open on external storefronts.",
};

export const revalidate = 60;

const STEPS = [
  {
    number: "01",
    title: "Inspect the record",
    body: "Review the picks attributed to that package, including record, ROI, units, and sample maturity.",
  },
  {
    number: "02",
    title: "Read the offer",
    body: "Check the listed package details, provider, and external price before leaving SCL.",
  },
  {
    number: "03",
    title: "Continue externally",
    body: "The provider handles checkout and the subscription. SCL does not process payment.",
  },
] as const;

function MarketplaceEmpty({ failed = false }: { failed?: boolean }) {
  return (
    <section
      className="border-border mt-6 border-y px-3 py-9 sm:px-6 sm:py-10"
      aria-live="polite"
    >
      <div className="max-w-2xl">
        <PackageOpen
          className="size-5 text-[color:var(--scl-muted-data)]"
          aria-hidden
        />
        <h2 className="scl-display text-foreground mt-3 text-xl font-semibold">
          {failed
            ? "Offers are temporarily unavailable"
            : "No public offers are listed"}
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          {failed
            ? "The public offer register could not be loaded. Please try again shortly."
            : "No approved external offers currently meet the publication rules. Public capper records remain available to inspect."}
        </p>
        {!failed ? (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button
              render={<Link href="/discover" />}
              nativeButton={false}
              variant="nav"
              className="min-h-10 gap-2"
            >
              Inspect public records
              <ArrowRight className="size-4" aria-hidden />
            </Button>
            <Button
              render={<Link href="/leaderboard" />}
              nativeButton={false}
              variant="outline"
              className="min-h-10"
            >
              View leaderboard
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default async function PackagesPage() {
  const marketplace = await listActiveMarketplacePackagesResult();
  const capperDirectory = await listPublicMarketplaceCappersResult();
  let evidence = { cappers: [], failed: false } as Awaited<
    ReturnType<typeof getPublicCapperEvidenceByIds>
  >;
  let packagePerformance = {
    evidence: {},
    profiles: {},
    failed: false,
  } as Awaited<ReturnType<typeof getPackagePerformanceEvidence>>;

  if (!marketplace.failed && marketplace.packages.length > 0) {
    // Production intentionally uses one Prisma connection per serverless
    // isolate. Keep these reads sequential so a full legacy catalog cannot
    // make its own evidence queries compete for that single connection.
    evidence = await getPublicCapperEvidenceByIds(
      marketplace.packages.map((pkg) => pkg.capperId),
    );
    packagePerformance = await getPackagePerformanceEvidence(
      marketplace.packages.map((pkg) => pkg.id),
    );
  }

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <header className="border-border border-b pb-6">
        <div className="scl-section-mark">
          <p className="scl-eyebrow text-[color:var(--scl-muted-data)]">
            SCL public offer register
          </p>
          <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="scl-page-title text-foreground">Packages</h1>
              <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed sm:text-base">
                Compare each capper&apos;s overall public record with the picks
                specifically attributed to an offer before opening its external
                storefront.
              </p>
            </div>
            <Link
              href="#how-packages-work"
              className="focus-visible:ring-ring inline-flex min-h-10 items-center text-sm font-semibold underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
            >
              How packages work
            </Link>
          </div>
        </div>

        <div className="mt-5 flex max-w-4xl items-start gap-2.5 text-sm leading-relaxed">
          <ShieldCheck
            className="mt-0.5 size-4 shrink-0 text-[color:var(--scl-pink)]"
            aria-hidden
          />
          <p className="text-muted-foreground">
            <span className="text-foreground font-semibold">
              Evidence stays on SCL.
            </span>{" "}
            {STOREFRONT_PAYMENT_DISCLAIMER}
          </p>
        </div>
      </header>

      {marketplace.failed ? (
        <MarketplaceEmpty failed />
      ) : marketplace.packages.length ? (
        <>
          <PackagesRegister
            packages={marketplace.packages}
            searchCappers={capperDirectory.cappers}
            cappers={evidence.cappers}
            packageEvidence={packagePerformance.evidence}
            evidenceFailed={packagePerformance.failed}
          />
          <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
            Package performance includes only picks explicitly attributed to
            that offer. Past performance is not a guarantee of future results.
          </p>
        </>
      ) : (
        <MarketplaceEmpty />
      )}

      <section
        id="how-packages-work"
        className="mt-10 scroll-mt-24"
        aria-labelledby="how-packages-title"
      >
        <div className="scl-section-mark flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="scl-eyebrow text-[color:var(--scl-muted-data)]">
              Process
            </p>
            <h2
              id="how-packages-title"
              className="scl-display text-foreground mt-1 text-xl font-semibold"
            >
              How packages work
            </h2>
          </div>
          <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
            The public record and the external offer stay visibly separate.
          </p>
        </div>
        <ol className="border-border scl-elevated mt-4 grid overflow-hidden rounded-[14px] border sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li
              key={step.number}
              className={`px-4 py-5 sm:px-5 ${
                index > 0
                  ? "border-border border-t sm:border-t-0 sm:border-l"
                  : ""
              }`}
            >
              <p className="scl-data text-xs font-semibold text-[color:var(--scl-pink-text)] tabular-nums">
                {step.number}
              </p>
              <h3 className="text-foreground mt-2 font-semibold">
                {step.title}
              </h3>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
