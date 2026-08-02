import Link from "next/link";

import { ProviderBadge } from "@/components/scl/provider-badge";
import { cn } from "@/lib/utils";

type InventoryPackage = {
  id: string;
  title: string;
  priceLabel: string | null;
  isActive: boolean;
  provider: string | null;
  storeConnectionId: string | null;
  unattached: boolean;
  trackingSlug: string | null;
  clicks: number;
  attributedPicks: number;
  publishable: boolean;
};

/**
 * Everything a capper already sells, shown while an admin reviews a new
 * storefront or package.
 *
 * The review panel lists only packages tied to the connection under review, so
 * without this an admin approving a second provider — or any storefront for a
 * capper carried over from the previous platform, whose offers have no
 * connection at all — sees "no packages yet" for someone already selling.
 */
export function AdminCapperPackageInventory({
  packages,
  currentConnectionId,
  className,
}: {
  packages: InventoryPackage[];
  /** Packages on the connection being reviewed are marked, not repeated. */
  currentConnectionId?: string | null;
  className?: string;
}) {
  const live = packages.filter((p) => p.isActive).length;
  const notPublishable = packages.filter(
    (p) => p.isActive && !p.publishable,
  ).length;

  return (
    <section
      className={cn("border-border rounded-lg border", className)}
      aria-label="Packages this capper already has"
    >
      <header className="border-border flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b px-3 py-2">
        <h3 className="text-sm font-semibold">Existing packages</h3>
        <p className="text-muted-foreground text-xs tabular-nums">
          {packages.length === 0
            ? "none"
            : `${packages.length} total · ${live} live`}
        </p>
      </header>

      {packages.length === 0 ? (
        <p className="text-muted-foreground px-3 py-4 text-sm">
          This capper has no packages yet on any provider.
        </p>
      ) : (
        <>
          {notPublishable > 0 ? (
            <p className="text-warn border-border border-b px-3 py-2 text-xs">
              {notPublishable} active{" "}
              {notPublishable === 1 ? "package is" : "packages are"} missing a
              checkout link or tracking URL, so{" "}
              {notPublishable === 1 ? "it does" : "they do"} not appear
              publicly.
            </p>
          ) : null}
          <ul className="divide-border divide-y">
            {packages.map((pkg) => (
              <li
                key={pkg.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-medium">
                      {pkg.title}
                    </span>
                    {pkg.provider ? (
                      <ProviderBadge
                        provider={pkg.provider as "WINIBLE" | "WHOP"}
                      />
                    ) : null}
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide uppercase",
                        pkg.isActive
                          ? "bg-pos/15 text-pos"
                          : "bg-surface-3 text-muted-foreground",
                      )}
                    >
                      {pkg.isActive ? "Live" : "Hidden"}
                    </span>
                    {currentConnectionId &&
                    pkg.storeConnectionId === currentConnectionId ? (
                      <span className="bg-primary/15 text-primary rounded px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide uppercase">
                        This storefront
                      </span>
                    ) : null}
                    {pkg.unattached ? (
                      <span
                        className="bg-surface-3 text-muted-foreground rounded px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide uppercase"
                        title="No store connection — carried over from the previous platform, or created before onboarding existed"
                      >
                        No connection
                      </span>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                    {pkg.priceLabel ?? "Price shown by provider"}
                    {" · "}
                    {pkg.clicks.toLocaleString()}{" "}
                    {pkg.clicks === 1 ? "click" : "clicks"}
                    {" · "}
                    {pkg.attributedPicks.toLocaleString()} attributed
                    {pkg.attributedPicks === 1 ? " pick" : " picks"}
                    {pkg.trackingSlug ? null : " · no tracking URL"}
                  </p>
                </div>
                {pkg.trackingSlug ? (
                  <Link
                    href={`/go/${pkg.trackingSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    // /go writes a ClickEvent on every GET — prefetching an
                    // admin list of these would invent clicks wholesale.
                    prefetch={false}
                    className="scl-link inline-flex min-h-10 shrink-0 items-center text-xs font-medium"
                  >
                    Open offer
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
