import { PackageOpen, Store } from "lucide-react";

import { EmptyState } from "@/components/scl/states";
import {
  PackageCard,
  type PackageCardData,
} from "@/components/scl/package-card";
import {
  PAYMENT_OUTCOME_DISCLAIMER,
  STOREFRONT_EMPTY_BODY,
  STOREFRONT_EMPTY_TITLE,
  STOREFRONT_PAYMENT_DISCLAIMER,
} from "@/lib/cold-start-copy";
import type { StorefrontSummary } from "@/lib/mock";
import { cn } from "@/lib/utils";

/**
 * Capper marketplace / third-party checkout panel.
 * Live packages use SCL tracking URLs only — never raw affiliate destinations.
 */
export function CapperStorefront({
  storefront,
  capperName,
  packages = [],
  className,
}: {
  storefront?: StorefrontSummary | null;
  capperName: string;
  packages?: PackageCardData[];
  className?: string;
}) {
  const linked = Boolean(storefront?.enabled);
  const hasPackages = packages.length > 0;

  if (!linked && !hasPackages) {
    return (
      <section id="storefront" className={cn("mt-8 scroll-mt-20", className)}>
        <EmptyState
          className="py-8"
          icon={PackageOpen}
          title={STOREFRONT_EMPTY_TITLE}
          description={STOREFRONT_EMPTY_BODY}
        />
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          {STOREFRONT_PAYMENT_DISCLAIMER}
        </p>
        <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
          <a
            href="/responsible-gaming"
            className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            Responsible gaming
          </a>
          {" · "}
          Records are informational and do not guarantee future outcomes.
        </p>
      </section>
    );
  }

  return (
    <section id="storefront" className={cn("mt-8 scroll-mt-20", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="bg-surface-2 flex size-9 shrink-0 items-center justify-center rounded-lg text-[color:var(--scl-pink)]">
            <Store className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-foreground text-xs font-semibold tracking-wide uppercase">
              Marketplace
            </p>
            <h2 className="mt-1 text-lg font-semibold sm:text-xl">
              {storefront?.title || `${capperName} Packages`}
            </h2>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
              {storefront?.description ||
                "Approved offers link out through SCL tracking URLs to the capper’s third-party storefront."}
            </p>
          </div>
        </div>
        <span className="border-border bg-surface-2 text-muted-foreground inline-flex min-h-8 shrink-0 items-center self-start rounded-lg border px-2.5 text-xs font-medium">
          Third-Party Checkout
        </span>
      </div>

      {hasPackages ? (
        <div className="mt-4 grid gap-3">
          {packages.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-4 py-8"
          icon={PackageOpen}
          title={STOREFRONT_EMPTY_TITLE}
          description={`${capperName} has not published live packages yet. You can still inspect their public record on SCL.`}
        />
      )}

      <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
        {PAYMENT_OUTCOME_DISCLAIMER}
      </p>
      <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
        <a
          href="/responsible-gaming"
          className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          Responsible gaming
        </a>
      </p>
    </section>
  );
}
