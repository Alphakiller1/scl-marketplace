import Link from "next/link";
import { Store } from "lucide-react";

import { AdminPackageForm } from "@/components/scl/admin-package-form";
import { AdminStoreActions } from "@/components/scl/admin-store-actions";
import { ProviderBadge } from "@/components/scl/provider-badge";
import { StoreStatusChip } from "@/components/scl/store-status-chip";
import { EmptyState } from "@/components/scl/states";
import { SectionHeader } from "@/components/scl/section";
import { Button } from "@/components/ui/button";
import {
  adminChecklist,
  importStatusLabel,
  providerLabel,
} from "@/lib/store-connection";
import { listStoreConnections } from "@/lib/queries/store";

export const metadata = { title: "Store setup" };

type Search = { searchParams: Promise<{ id?: string; provider?: string }> };

export default async function AdminStoreSetupPage({ searchParams }: Search) {
  const sp = await searchParams;
  const rows = await listStoreConnections({
    provider:
      sp.provider === "WINIBLE" || sp.provider === "WHOP" ? sp.provider : "ALL",
  });
  const selected =
    rows.find((r) => r.id === sp.id) ||
    rows.find((r) =>
      ["PENDING_SCL_ACCEPTANCE", "PENDING_SCL_LINK_IMPORT"].includes(r.status),
    ) ||
    rows[0] ||
    null;

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Store}
        title="Store Setup Requests"
        subtitle="Winible requires affiliate acceptance. Whop may email SCL in some cases — either way, import from the Whop affiliate dashboard (%, package links, checkout, storefront)."
      />

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["ALL", "All"],
            ["WINIBLE", "Winible"],
            ["WHOP", "Whop"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={
              (sp.provider || "ALL") === key || (!sp.provider && key === "ALL")
                ? "default"
                : "outline"
            }
            className="min-h-10"
            render={
              <Link
                href={
                  key === "ALL"
                    ? "/admin/store-setup"
                    : `/admin/store-setup?provider=${key}`
                }
              />
            }
            nativeButton={false}
          >
            {label}
          </Button>
        ))}
      </div>

      {rows.length ? (
        <div className="border-border overflow-hidden rounded-xl border">
          <div className="border-border bg-surface-2 text-muted-foreground hidden grid-cols-[1.2fr_6rem_1fr_7rem_1fr_auto] gap-3 border-b px-4 py-2 text-[0.65rem] font-semibold tracking-wide uppercase lg:grid">
            <span>Capper</span>
            <span>Platform</span>
            <span>Status</span>
            <span>Submitted</span>
            <span>Import</span>
            <span>Open</span>
          </div>
          <div className="divide-border divide-y">
            {rows.map((row) => {
              const handle = row.capper.user.username;
              const name =
                row.capper.user.displayName?.trim() ||
                (handle
                  ? `@${handle.replace(/^@/, "")}`
                  : row.capper.user.email);
              return (
                <article
                  key={row.id}
                  className="bg-card grid gap-3 p-4 lg:grid-cols-[1.2fr_6rem_1fr_7rem_1fr_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{name}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {row.capper.user.email}
                    </p>
                  </div>
                  <ProviderBadge provider={row.provider} />
                  <StoreStatusChip status={row.status} />
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {row.submittedAt ? row.submittedAt.toLocaleString() : "—"}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {importStatusLabel(row.packageImportStatus)}
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="min-h-10"
                    render={
                      <Link
                        href={`/admin/store-setup?id=${row.id}${
                          sp.provider ? `&provider=${sp.provider}` : ""
                        }`}
                      />
                    }
                    nativeButton={false}
                  >
                    Open
                  </Button>
                </article>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Store}
          title="No store setup requests"
          description="When a capper submits Winible or Whop onboarding from Monetization Center, it appears here."
        />
      )}

      {selected ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="border-border bg-card space-y-4 rounded-xl border p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="scl-display text-base font-bold tracking-[0.05em] uppercase">
                Request detail
              </h2>
              <ProviderBadge provider={selected.provider} />
              <StoreStatusChip status={selected.status} />
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {selected.provider === "WHOP"
                ? "Whop may send an affiliate notification email in some cases. Once the relationship is live, use the Whop dashboard (affiliate %, product links, checkout links, storefront) — same package fields as Winible."
                : "Wait for Winible email → accept affiliate → copy package links → save packages."}
            </p>
            <ul className="space-y-2 text-sm">
              {adminChecklist(selected.provider).map((item) => (
                <li key={item} className="flex gap-2">
                  <input type="checkbox" className="mt-1 size-4" readOnly />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            {selected.adminNotes ? (
              <p className="border-border bg-surface-2 rounded-lg border p-3 text-sm">
                <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Admin notes
                </span>
                <br />
                {selected.adminNotes}
              </p>
            ) : null}
            <AdminStoreActions connectionId={selected.id} />
            {selected.capper.user.username ? (
              <Button
                variant="ghost"
                className="min-h-10"
                render={
                  <Link href={`/cappers/${selected.capper.user.username}`} />
                }
                nativeButton={false}
              >
                View public profile
              </Button>
            ) : null}
          </section>

          <section className="border-border bg-card space-y-4 rounded-xl border p-5">
            <h2 className="scl-display text-base font-bold tracking-[0.05em] uppercase">
              Package object · {providerLabel(selected.provider)}
            </h2>
            <AdminPackageForm
              capperId={selected.capper.id}
              storeConnectionId={selected.id}
              provider={selected.provider}
              initial={
                selected.packages[0]
                  ? {
                      id: selected.packages[0].id,
                      title: selected.packages[0].title,
                      description: selected.packages[0].description,
                      promoOffer: selected.packages[0].promoOffer,
                      checkoutUrl: selected.packages[0].checkoutUrl,
                      priceCents: selected.packages[0].priceCents,
                      billingPeriod: selected.packages[0].billingPeriod,
                      sortOrder: selected.packages[0].sortOrder,
                      isActive: selected.packages[0].isActive,
                      trackingSlug:
                        selected.packages[0].trackingUrls[0]?.slug || null,
                    }
                  : null
              }
            />
            {selected.packages.length > 1 ? (
              <div className="border-border space-y-2 border-t pt-4">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Other packages
                </p>
                {selected.packages.slice(1).map((pkg) => (
                  <div
                    key={pkg.id}
                    className="border-border flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                  >
                    <span className="truncate font-medium">{pkg.title}</span>
                    <StoreStatusChip
                      status={pkg.isActive ? "LIVE" : "NOT_STARTED"}
                      label={pkg.isActive ? "Live" : "Draft"}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
