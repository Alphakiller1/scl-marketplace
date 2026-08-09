import Link from "next/link";
import { PackageOpen, Pencil, Search } from "lucide-react";

import { AdminPackageForm } from "@/components/scl/admin-package-form";
import { AdminPackageRowControls } from "@/components/scl/admin-package-row-controls";
import { ProviderBadge } from "@/components/scl/provider-badge";
import { SectionHeader } from "@/components/scl/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listAdminPackages } from "@/lib/queries/store";
import { formatPriceCents } from "@/lib/store-connection";

export const metadata = { title: "Manage packages" };

export default async function AdminPackagesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; packageId?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const result = await listAdminPackages({
    search: query,
    page: Number.isFinite(requestedPage) ? requestedPage : 1,
  });
  const selected = result.packages.find((pkg) => pkg.id === params.packageId);

  function href(overrides: { page?: number; packageId?: string | null }) {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (overrides.page && overrides.page > 1) {
      next.set("page", String(overrides.page));
    }
    if (overrides.packageId) next.set("packageId", overrides.packageId);
    const suffix = next.toString();
    return `/admin/packages${suffix ? `?${suffix}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={PackageOpen}
        title="Manage Every Package"
        subtitle="Search every SCL package—including legacy offers without a storefront connection—and edit, show, hide, or permanently delete it."
      />

      <form className="flex flex-col gap-2 sm:flex-row" method="get">
        <div className="relative min-w-0 flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search package, capper, handle, or email"
            className="pl-9"
            aria-label="Search every package"
          />
        </div>
        <Button type="submit">Search packages</Button>
        {query ? (
          <Button
            variant="outline"
            render={<Link href="/admin/packages" />}
            nativeButton={false}
          >
            Clear
          </Button>
        ) : null}
      </form>

      <div className="border-border overflow-hidden rounded-xl border">
        <div className="border-border bg-surface-2 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div>
            <h2 className="font-semibold">All platform packages</h2>
            <p className="text-muted-foreground text-xs">
              {result.total.toLocaleString()} package
              {result.total === 1 ? "" : "s"} found
            </p>
          </div>
          <p className="text-muted-foreground text-xs tabular-nums">
            Page {result.page} of {result.pageCount}
          </p>
        </div>

        {result.packages.length ? (
          <div className="divide-border divide-y">
            {result.packages.map((pkg) => {
              const provider =
                pkg.affiliateProvider ?? pkg.storeConnection?.provider ?? null;
              const owner =
                pkg.capper.user.displayName?.trim() ||
                (pkg.capper.user.username
                  ? `@${pkg.capper.user.username.replace(/^@/, "")}`
                  : pkg.capper.user.email);
              const clicks = pkg.trackingUrls.reduce(
                (sum, item) => sum + item._count.clicks,
                0,
              );
              return (
                <article
                  key={pkg.id}
                  className="bg-card grid gap-3 p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_7rem_8rem_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{pkg.title}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {owner} · {pkg.capper.user.email}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {provider ? (
                      <ProviderBadge provider={provider} />
                    ) : (
                      <span className="text-warn text-xs font-semibold">
                        Provider needed
                      </span>
                    )}
                    <span
                      className={
                        pkg.isActive
                          ? "text-pos text-xs font-semibold"
                          : "text-muted-foreground text-xs font-semibold"
                      }
                    >
                      {pkg.isActive ? "Active" : "Hidden"}
                    </span>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatPriceCents(pkg.priceCents, pkg.billingPeriod) ??
                      "No price"}
                  </p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {clicks.toLocaleString()} clicks
                  </p>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <Button
                      size="sm"
                      variant="secondary"
                      render={
                        <Link
                          href={`${href({ page: result.page, packageId: pkg.id })}#package-editor`}
                        />
                      }
                      nativeButton={false}
                    >
                      <Pencil className="size-3.5" aria-hidden /> Edit
                    </Button>
                    <AdminPackageRowControls
                      packageId={pkg.id}
                      title={pkg.title}
                      isActive={pkg.isActive}
                      isFirst
                      isLast
                      showReorder={false}
                      labeled
                    />
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground p-6 text-sm">
            No packages match this search.
          </p>
        )}
      </div>

      {result.pageCount > 1 ? (
        <nav
          className="flex items-center justify-between gap-3"
          aria-label="Package pages"
        >
          <Button
            variant="outline"
            disabled={result.page <= 1}
            render={
              result.page > 1 ? (
                <Link href={href({ page: result.page - 1 })} />
              ) : undefined
            }
            nativeButton={result.page <= 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={result.page >= result.pageCount}
            render={
              result.page < result.pageCount ? (
                <Link href={href({ page: result.page + 1 })} />
              ) : undefined
            }
            nativeButton={result.page >= result.pageCount}
          >
            Next
          </Button>
        </nav>
      ) : null}

      {selected ? (
        <section
          id="package-editor"
          className="border-brand/40 bg-card space-y-4 rounded-xl border-2 p-4 sm:p-5"
        >
          <SectionHeader
            icon={Pencil}
            title={`Edit: ${selected.title}`}
            subtitle="Save changes here. Delete remains available on the package row above."
          />
          <AdminPackageForm
            key={selected.id}
            capperId={selected.capperId}
            storeConnectionId={selected.storeConnectionId}
            provider={
              selected.affiliateProvider ?? selected.storeConnection?.provider
            }
            initial={{
              id: selected.id,
              title: selected.title,
              description: selected.description,
              promoOffer: selected.promoOffer,
              checkoutUrl: selected.checkoutUrl,
              priceCents: selected.priceCents,
              billingPeriod: selected.billingPeriod,
              sortOrder: selected.sortOrder,
              isActive: selected.isActive,
              trackingSlug: selected.trackingUrls[0]?.slug ?? null,
              clickCount: selected.trackingUrls.reduce(
                (sum, item) => sum + item._count.clicks,
                0,
              ),
            }}
          />
        </section>
      ) : null}
    </div>
  );
}
