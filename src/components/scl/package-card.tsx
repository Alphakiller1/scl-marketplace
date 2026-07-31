import Link from "next/link";
import type { StoreProvider } from "@prisma/client";
import { ArrowUpRight } from "lucide-react";

import { ProviderBadge } from "@/components/scl/provider-badge";
import { Button } from "@/components/ui/button";
import { STOREFRONT_OUTBOUND_MICROCOPY } from "@/lib/cold-start-copy";
import { packageCtaLabel } from "@/lib/store-connection";
import { cn } from "@/lib/utils";

export type PackageCardData = {
  id: string;
  title: string;
  description?: string | null;
  promoOffer?: string | null;
  priceLabel?: string | null;
  provider?: StoreProvider | null;
  trackingPath: string;
  capperName?: string;
  capperHandle?: string;
};

export function PackageCard({
  pkg,
  className,
}: {
  pkg: PackageCardData;
  className?: string;
}) {
  const cta = packageCtaLabel(pkg.provider);

  return (
    <article
      className={cn(
        "border-border bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {pkg.provider ? <ProviderBadge provider={pkg.provider} /> : null}
        {pkg.capperHandle ? (
          <Link
            href={`/cappers/${pkg.capperHandle}`}
            className="text-muted-foreground text-xs font-semibold tracking-normal underline-offset-4 hover:underline"
          >
            {pkg.capperName || `@${pkg.capperHandle}`}
          </Link>
        ) : null}
      </div>
      <div className="min-w-0">
        <h3 className="scl-display text-base font-semibold tracking-[0.02em] normal-case">
          {pkg.title}
        </h3>
        {pkg.description ? (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-sm leading-relaxed">
            {pkg.description}
          </p>
        ) : null}
        {pkg.promoOffer ? (
          <p className="text-foreground mt-2 text-xs font-semibold tracking-normal">
            {pkg.promoOffer}
          </p>
        ) : null}
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
        {pkg.priceLabel ? (
          <p className="nums text-sm font-semibold tabular-nums">
            {pkg.priceLabel}
          </p>
        ) : (
          <span />
        )}
        <Button
          render={
            <Link
              href={pkg.trackingPath}
              target="_blank"
              rel="noopener noreferrer"
              // /go/[slug] writes a ClickEvent on every GET — prefetching it
              // would record a click nobody made. See packages-register.tsx.
              prefetch={false}
            />
          }
          nativeButton={false}
          className="min-h-10 gap-1.5"
        >
          {cta}
          <ArrowUpRight className="size-4" aria-hidden />
        </Button>
      </div>
      <p className="text-muted-foreground text-[0.65rem] leading-relaxed">
        {STOREFRONT_OUTBOUND_MICROCOPY}
      </p>
    </article>
  );
}
