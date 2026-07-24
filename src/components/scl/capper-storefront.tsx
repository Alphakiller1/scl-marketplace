import { ExternalLink, PackageOpen, Store } from "lucide-react";

import { EmptyState } from "@/components/scl/states";
import type { PublicLivePackage } from "@/lib/queries/admin-storefronts";
import type { StorefrontSummary } from "@/lib/mock";
import { formatPackagePrice } from "@/lib/commerce";
import { cn } from "@/lib/utils";

export function CapperStorefront({
  storefront,
  capperName,
  packages = [],
  className,
}: {
  storefront: StorefrontSummary;
  capperName: string;
  packages?: PublicLivePackage[];
  className?: string;
}) {
  if (!storefront.enabled) return null;

  return (
    <section id="storefront" className={cn("mt-8 scroll-mt-20", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="bg-surface-2 text-brand flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Store className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-brand text-xs font-semibold uppercase">
              Marketplace
            </p>
            <h2 className="mt-1 text-lg font-semibold sm:text-xl">
              {storefront.title}
            </h2>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
              {storefront.description}
            </p>
          </div>
        </div>
        <span className="border-border bg-surface-2 text-muted-foreground inline-flex min-h-8 shrink-0 items-center self-start rounded-lg border px-2.5 text-xs font-medium">
          Third-Party Checkout
        </span>
      </div>

      {packages.length ? (
        <div className="mt-4 space-y-3">
          {packages.map((pkg) => {
            const href = pkg.trackingSlug ? `/go/${pkg.trackingSlug}` : null;
            return (
              <article
                key={pkg.id}
                className="border-border bg-card rounded-xl border p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{pkg.title}</h3>
                    {pkg.description ? (
                      <p className="text-muted-foreground mt-1 text-sm">
                        {pkg.description}
                      </p>
                    ) : null}
                    <p className="mt-2 text-sm font-semibold">
                      {formatPackagePrice(pkg.priceCents, pkg.billingPeriod)}
                    </p>
                    {pkg.trialTerms ? (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {pkg.trialTerms}
                      </p>
                    ) : null}
                  </div>
                  {href ? (
                    <a
                      href={href}
                      className="bg-brand text-brand-foreground inline-flex min-h-9 items-center gap-1 rounded-lg px-3 text-sm font-semibold"
                    >
                      Buy
                      <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          className="mt-4 py-8"
          icon={PackageOpen}
          title="Packages Not Listed Yet"
          description={`${capperName} hasn't published packages on SCL. You can still review their tracked record and recent plays above.`}
        />
      )}

      <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
        Purchases, subscriptions, and fulfillment are handled by the applicable
        third-party storefront — SCL lists marketplace offers and does not
        process payments.
      </p>
    </section>
  );
}
