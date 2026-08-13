import Link from "next/link";
import { ArrowDown, PackageOpen } from "lucide-react";

import { PackageCard } from "@/components/scl/package-card";
import type { PackageEvidence } from "@/lib/package-register";
import type { PublicPackageCard } from "@/lib/queries/store";

export type ProfileTopPackage = {
  pkg: PublicPackageCard;
  /**
   * Retained on the type so the profile query and the opt-in flow keep their
   * shape; nothing is rendered from it while attribution is off.
   */
  evidence: PackageEvidence | null;
};

export function ProfileTopPackages({
  packages,
  totalCount,
}: {
  packages: ProfileTopPackage[];
  totalCount: number;
}) {
  if (packages.length === 0) return null;

  return (
    <section
      className="border-border border-b pb-6"
      aria-labelledby="top-purchase-packages"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="scl-section-mark">
          <p className="scl-eyebrow text-[color:var(--scl-muted-data)]">
            Available now
          </p>
          <h2
            id="top-purchase-packages"
            className="scl-display text-foreground mt-1 text-xl font-semibold"
          >
            Top Purchase Packages
          </h2>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Offers this capper currently sells. Performance is not broken out
            per package — the record above covers every pick.
          </p>
        </div>
        <Link
          href="#storefront"
          className="scl-link inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold"
        >
          {totalCount > packages.length
            ? "Browse other packages"
            : "View package details"}
          <ArrowDown className="size-4" aria-hidden />
        </Link>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {packages.map(({ pkg }) => (
          <div key={pkg.id} className="min-w-0">
            <PackageCard pkg={pkg} />
          </div>
        ))}
      </div>

      <p className="text-muted-foreground mt-3 flex items-start gap-2 text-xs leading-relaxed">
        <PackageOpen className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Checkout and subscription terms are handled by the listed third-party
        provider. Past performance does not guarantee future results.
      </p>
    </section>
  );
}
