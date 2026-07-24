import Link from "next/link";
import { Store } from "lucide-react";

import { AccountStatusBadge } from "@/components/scl/account-trust";
import { SectionHeader } from "@/components/scl/section";
import { EmptyState } from "@/components/scl/states";
import { StorefrontStatusBadge } from "@/components/scl/storefront-status-badge";
import { COMMERCE_PLATFORM_LABEL } from "@/lib/commerce";
import { scanStorefrontHealth } from "@/lib/storefront-health";
import { getAdminStorefrontRows } from "@/lib/queries/admin-storefronts";
import { StorefrontHealthPanel } from "@/components/scl/storefront-health-panel";

export const metadata = { title: "Storefronts" };

export default async function AdminStorefrontsPage() {
  const [rows, healthPreview] = await Promise.all([
    getAdminStorefrontRows(),
    scanStorefrontHealth(),
  ]);

  return (
    <div className="space-y-5">
      <SectionHeader
        icon={Store}
        title="Storefront Pipeline"
        subtitle="Track affiliate setup, package approval, and live checkout links"
      />

      <StorefrontHealthPanel preview={healthPreview} />

      {rows.length ? (
        <div className="border-border overflow-hidden rounded-xl border">
          <div className="border-border bg-surface-2 text-muted-foreground hidden grid-cols-[minmax(0,1fr)_8rem_7rem_5rem_6rem] gap-4 border-b px-4 py-2 text-xs font-semibold uppercase lg:grid">
            <span>Capper</span>
            <span>Platform</span>
            <span>Status</span>
            <span>Packages</span>
            <span>Clicks</span>
          </div>
          <div className="divide-border divide-y">
            {rows.map((row) => {
              const handle = row.user.username
                ? `@${row.user.username.replace(/^@/, "")}`
                : row.user.email;
              const livePackages = row.packages.filter(
                (pkg) =>
                  pkg.visibility === "LIVE" &&
                  !pkg.suspendedAt &&
                  pkg.checkoutUrl,
              ).length;
              const clicks = row.packages.reduce(
                (sum, pkg) =>
                  sum +
                  pkg.trackingUrls.reduce(
                    (inner, url) => inner + url._count.clicks,
                    0,
                  ),
                0,
              );

              return (
                <article
                  key={row.id}
                  className="bg-card grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_8rem_7rem_5rem_6rem] lg:items-center"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/admin/storefronts/${row.id}`}
                      className="font-semibold hover:underline"
                    >
                      {handle}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <AccountStatusBadge status={row.user.accountStatus} />
                      {row.lastReviewedAt ? (
                        <span className="text-muted-foreground text-xs">
                          Reviewed {row.lastReviewedAt.toLocaleDateString()}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-sm">
                    {COMMERCE_PLATFORM_LABEL[row.commercePlatform]}
                  </div>
                  <div>
                    <StorefrontStatusBadge status={row.storefrontStatus} />
                  </div>
                  <div className="nums text-sm font-semibold tabular-nums">
                    {livePackages}/{row._count.packages}
                  </div>
                  <div className="nums text-sm font-semibold tabular-nums">
                    {clicks}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Store}
          title="No Storefronts Yet"
          description="Capper accounts will appear here once they onboard."
        />
      )}
    </div>
  );
}
