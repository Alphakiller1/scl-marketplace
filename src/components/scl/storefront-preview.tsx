import { Eye, EyeOff, PackageOpen, Store } from "lucide-react";

import type { StorefrontIdentity } from "@/lib/storefront";

export function StorefrontPreview({
  storefront,
}: {
  storefront: StorefrontIdentity;
}) {
  return (
    <section
      aria-labelledby="storefront-preview-title"
      className="border-border bg-card overflow-hidden rounded-xl border"
    >
      <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2
          id="storefront-preview-title"
          className="text-sm font-semibold tracking-wide"
        >
          Storefront Preview
        </h2>
        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
          {storefront.enabled ? (
            <Eye className="size-3.5" aria-hidden />
          ) : (
            <EyeOff className="size-3.5" aria-hidden />
          )}
          {storefront.enabled ? "Public" : "Hidden"}
        </span>
      </div>

      <div className="p-4">
        <span className="bg-surface-2 flex size-9 items-center justify-center rounded-lg text-[color:var(--scl-blue)]">
          <Store className="size-4" aria-hidden />
        </span>
        <h3 className="mt-3 text-base font-semibold">{storefront.title}</h3>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          {storefront.description}
        </p>

        <div className="border-border bg-surface-2/50 mt-4 flex items-center gap-3 rounded-lg border border-dashed px-3 py-3">
          <PackageOpen
            className="text-muted-foreground size-5 shrink-0"
            aria-hidden
          />
          <p className="text-muted-foreground text-xs">
            Approved packages will appear here.
          </p>
        </div>
      </div>
    </section>
  );
}
