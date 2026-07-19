import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  PackageOpen,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";

import { PackageCard } from "@/components/scl/package-card";
import { SectionHeader } from "@/components/scl/section";
import { EmptyState } from "@/components/scl/states";
import { Button } from "@/components/ui/button";
import { STOREFRONT_PAYMENT_DISCLAIMER } from "@/lib/cold-start-copy";
import { listActiveMarketplacePackages } from "@/lib/queries/store";

export const metadata: Metadata = {
  title: "Packages",
  description:
    "Browse approved capper packages published through SCL. Payments stay on each capper’s external storefront.",
};

export const revalidate = 60;

const STEPS = [
  {
    icon: Users,
    title: "Inspect The Record First",
    body: "Open a capper profile and check graded sample, units, ROI, and verification before you buy anything off-platform.",
  },
  {
    icon: Store,
    title: "Packages Link Out",
    body: "Approved offers point to the capper’s own storefront (Whop, Winible, DubClub, or similar) through SCL tracking URLs.",
  },
  {
    icon: ShieldCheck,
    title: "Trust The Receipt Trail",
    body: "SCL’s job is transparent picks and rankings. Use the public board to decide who earns your attention.",
  },
] as const;

export default async function PackagesPage() {
  const packages = await listActiveMarketplacePackages();

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
      <SectionHeader
        icon={PackageOpen}
        title="Packages"
        subtitle="Approved capper offers — inspect the record, then leave SCL to pay"
      />

      {packages.length ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-6"
          icon={PackageOpen}
          title="No Packages Live Yet"
          description="The founding marketplace is still forming. When approved packages publish, they will appear here with a clear path to each capper’s external checkout."
          action={
            <div className="flex w-full max-w-md flex-col items-stretch gap-3 sm:items-center">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button
                  render={<Link href="/discover" />}
                  nativeButton={false}
                  className="min-h-11 gap-2"
                >
                  Browse Cappers
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
              <Button
                render={<Link href="/picks" />}
                nativeButton={false}
                variant="ghost"
                className="min-h-11"
              >
                See Latest Picks
              </Button>
            </div>
          }
        />
      )}

      <p className="text-muted-foreground mt-6 text-xs leading-relaxed">
        {STOREFRONT_PAYMENT_DISCLAIMER}
      </p>

      <section className="mt-10 space-y-4" aria-labelledby="packages-how">
        <h2
          id="packages-how"
          className="scl-display text-sm font-bold tracking-[0.08em] uppercase"
        >
          How packages work
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((step) => (
            <article
              key={step.title}
              className="border-border bg-card rounded-xl border p-4"
            >
              <span className="bg-surface-2 mb-3 inline-flex size-9 items-center justify-center rounded-lg text-[color:var(--scl-blue)]">
                <step.icon className="size-4" aria-hidden />
              </span>
              <h3 className="font-semibold">{step.title}</h3>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                {step.body}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
