import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, PackageOpen, ShieldCheck } from "lucide-react";

import { PackagesRegister } from "@/components/scl/packages-register";
import { Button } from "@/components/ui/button";
import { STOREFRONT_PAYMENT_DISCLAIMER } from "@/lib/cold-start-copy";
import { getPublicCapperEvidenceByIds } from "@/lib/queries/leaderboard";
import { listActiveMarketplacePackagesResult } from "@/lib/queries/store";

export const metadata: Metadata = {
  title: "Packages",
  description:
    "Inspect public capper records alongside approved offers that open on external storefronts.",
};

export const revalidate = 60;

const STEPS = [
  {
    number: "01",
    title: "Inspect The Record",
    body: "Review All-Time Record, ROI, Units, Sample Maturity, And Board-Verified Share.",
  },
  {
    number: "02",
    title: "Read The Offer",
    body: "Check The Listed Package Details, Provider, And External Price Before Leaving SCL.",
  },
  {
    number: "03",
    title: "Continue Externally",
    body: "The Provider Handles Checkout And The Subscription. SCL Does Not Process Payment.",
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
            ? "Offers Are Temporarily Unavailable"
            : "No Public Offers Are Listed"}
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          {failed
            ? "The Public Offer Register Could Not Be Loaded. Please Try Again Shortly."
            : "No Approved External Offers Currently Meet The Publication Rules. Public Capper Records Remain Available To Inspect."}
        </p>
        {!failed ? (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button
              render={<Link href="/discover" />}
              nativeButton={false}
              variant="nav"
              className="min-h-11 gap-2"
            >
              Inspect Public Records
              <ArrowRight className="size-4" aria-hidden />
            </Button>
            <Button
              render={<Link href="/leaderboard" />}
              nativeButton={false}
              variant="outline"
              className="min-h-11"
            >
              View Leaderboard
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default async function PackagesPage() {
  const marketplace = await listActiveMarketplacePackagesResult();
  const evidence =
    !marketplace.failed && marketplace.packages.length > 0
      ? await getPublicCapperEvidenceByIds(
          marketplace.packages.map((pkg) => pkg.capperId),
        )
      : { cappers: [], failed: false };

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <header className="border-border border-b pb-6">
        <div className="scl-section-mark">
          <p className="scl-eyebrow text-[color:var(--scl-muted-data)]">
            SCL Public Offer Register
          </p>
          <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="scl-page-title text-foreground">Packages</h1>
              <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed sm:text-base">
                Inspect A Capper&apos;s Public Evidence Before Opening An Offer
                On An External Storefront.
              </p>
            </div>
            <Link
              href="#how-packages-work"
              className="focus-visible:ring-ring inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
            >
              How Packages Work
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
              Evidence Stays On SCL.
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
            cappers={evidence.cappers}
            evidenceFailed={evidence.failed}
          />
          <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
            Verified Share Describes Board Verification At Submission, Not Pick
            Outcomes. Past Performance Is Not A Guarantee Of Future Results.
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
              How Packages Work
            </h2>
          </div>
          <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
            The Public Record And The External Offer Stay Visibly Separate.
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
