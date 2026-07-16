import { PackageOpen, Store } from "lucide-react";

import { EmptyState } from "@/components/scl/states";
import type { StorefrontSummary } from "@/lib/mock";
import { cn } from "@/lib/utils";

export function CapperStorefront({
  storefront,
  capperName,
  className,
}: {
  storefront: StorefrontSummary;
  capperName: string;
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
        <span className="border-border bg-card text-muted-foreground inline-flex min-h-8 shrink-0 items-center self-start rounded-lg border px-2.5 text-xs font-medium">
          Leaves SCL
        </span>
      </div>

      <EmptyState
        className="mt-4 py-8"
        icon={PackageOpen}
        title="Packages Not Listed Yet"
        description={`${capperName} hasn't published packages here. Their inspectable record and recent Tickets stay above.`}
      />

      <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
        Checkout and fulfillment happen on a third-party storefront. SCL does
        not process payments — leaving this page means you&apos;re off SCL.
      </p>
    </section>
  );
}
