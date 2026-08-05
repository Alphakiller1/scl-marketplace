import Link from "next/link";
import { History, Store } from "lucide-react";

import { AdminCapperPackageInventory } from "@/components/scl/admin-capper-package-inventory";
import { StorefrontConversationPanel } from "@/components/scl/storefront-conversation-panel";
import { AdminPackageForm } from "@/components/scl/admin-package-form";
import { AdminPackageRowControls } from "@/components/scl/admin-package-row-controls";
import { AdminStoreActions } from "@/components/scl/admin-store-actions";
import { AdminWhopSyncPanel } from "@/components/scl/admin-whop-sync-panel";
import { ProviderBadge } from "@/components/scl/provider-badge";
import { StorefrontCoveragePanel } from "@/components/scl/storefront-coverage-panel";
import { StoreStatusChip } from "@/components/scl/store-status-chip";
import { EmptyState } from "@/components/scl/states";
import { SectionHeader } from "@/components/scl/section";
import { Button } from "@/components/ui/button";
import { importStatusLabel, providerLabel } from "@/lib/store-connection";
import {
  adminStorefrontReadiness,
  packagePublicationLabel,
} from "@/lib/storefront-ops";
import {
  getCapperPackagesForReview,
  getStorefrontCoverage,
  getStorefrontReviewHistory,
  listStoreConnections,
} from "@/lib/queries/store";
import { getStorefrontMessages } from "@/lib/queries/storefront-messages";
import { markStorefrontThreadReadAction } from "@/lib/actions/storefront-message.action";
import { storefrontReviewActionLabel } from "@/lib/storefront-review";
import { whopAffiliateUsername, whopOAuthConfigured } from "@/lib/whop-config";
import { cn } from "@/lib/utils";

export const metadata = { title: "Store setup" };

type Search = {
  searchParams: Promise<{
    id?: string;
    provider?: string;
    packageId?: string;
    requiresAttention?: string;
  }>;
};

export default async function AdminStoreSetupPage({ searchParams }: Search) {
  const sp = await searchParams;
  const requiresAttentionFilter = sp.requiresAttention === "true";
  const [rows, coverage] = await Promise.all([
    listStoreConnections({
      provider:
        sp.provider === "WINIBLE" || sp.provider === "WHOP"
          ? sp.provider
          : "ALL",
      requiresAttentionOnly: requiresAttentionFilter,
    }),
    getStorefrontCoverage(),
  ]);
  const selected =
    rows.find((r) => r.id === sp.id) ||
    rows.find((r) =>
      ["PENDING_SCL_ACCEPTANCE", "PENDING_SCL_LINK_IMPORT"].includes(r.status),
    ) ||
    rows[0] ||
    null;

  const selectedPackage =
    selected?.packages.find((p) => p.id === sp.packageId) ||
    selected?.packages[0] ||
    null;
  const creatingNew = Boolean(selected && sp.packageId === "new");
  // Everything this capper already sells, across every provider — including
  // offers with no store connection, which is all of the carried-over ones.
  const [reviewHistory, capperPackages, threadMessages] = selected
    ? await Promise.all([
        getStorefrontReviewHistory(selected.id),
        getCapperPackagesForReview(selected.capper.id),
        getStorefrontMessages(selected.id),
      ])
    : [[], [], []];

  if (selected) {
    await markStorefrontThreadReadAction({
      storeConnectionId: selected.id,
    });
  }

  function detailHref(opts: {
    connectionId: string;
    packageId?: string | null;
  }) {
    const params = new URLSearchParams();
    params.set("id", opts.connectionId);
    if (sp.provider) params.set("provider", sp.provider);
    if (requiresAttentionFilter) params.set("requiresAttention", "true");
    if (opts.packageId) params.set("packageId", opts.packageId);
    return `/admin/store-setup?${params.toString()}`;
  }

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
                    ? `/admin/store-setup${requiresAttentionFilter ? "?requiresAttention=true" : ""}`
                    : `/admin/store-setup?provider=${key}${requiresAttentionFilter ? "&requiresAttention=true" : ""}`
                }
              />
            }
            nativeButton={false}
          >
            {label}
          </Button>
        ))}
        <Button
          size="sm"
          variant={requiresAttentionFilter ? "default" : "outline"}
          className="min-h-10"
          render={
            <Link
              href={
                requiresAttentionFilter
                  ? `/admin/store-setup${sp.provider ? `?provider=${sp.provider}` : ""}`
                  : `/admin/store-setup?requiresAttention=true${sp.provider ? `&provider=${sp.provider}` : ""}`
              }
            />
          }
          nativeButton={false}
        >
          Needs attention
        </Button>
      </div>

      {rows.length ? (
        <div className="border-border overflow-hidden rounded-xl border">
          <div className="border-border bg-surface-2 text-muted-foreground hidden grid-cols-[1.2fr_6rem_1fr_1fr_6rem_1fr_1fr_auto] gap-3 border-b px-4 py-2 text-[0.65rem] font-semibold tracking-wide uppercase lg:grid">
            <span>Capper</span>
            <span>Platform</span>
            <span>Status</span>
            <span>Packages</span>
            <span>Affiliate %</span>
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
              const packageCountDisplay = row.packageCount;
              const affiliatePercentDisplay =
                row.affiliatePercent != null
                  ? Number(row.affiliatePercent).toFixed(0)
                  : "—";
              return (
                <article
                  key={row.id}
                  className={cn(
                    "bg-card grid gap-3 p-4 lg:grid-cols-[1.2fr_6rem_1fr_1fr_6rem_1fr_1fr_auto] lg:items-center",
                    row.requiresAttention &&
                      "ring-2 ring-amber-400/30 ring-inset",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{name}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {row.capper.user.email}
                    </p>
                  </div>
                  <ProviderBadge provider={row.provider} />
                  <StoreStatusChip status={row.status} />
                  <p className="text-muted-foreground text-xs">
                    {packageCountDisplay} package
                    {packageCountDisplay !== 1 ? "s" : ""}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {affiliatePercentDisplay}
                    {affiliatePercentDisplay !== "—" && "%"}
                  </p>
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
                      <Link href={detailHref({ connectionId: row.id })} />
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
          description="When a capper submits Winible or Whop onboarding from Storefront setup, it appears here."
        />
      )}

      {selected ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="border-border bg-card space-y-4 rounded-xl border p-5">
            {/* Whose storefront this is must be unmistakable — an admin is
                approving a specific capper, not an anonymous "request". */}
            <div className="border-border border-b pb-3">
              <p className="scl-eyebrow text-[color:var(--scl-muted-data)]">
                Storefront for
              </p>
              <h2 className="scl-display mt-0.5 text-lg font-bold tracking-[0.02em] normal-case">
                {selected.capper.user.displayName?.trim() ||
                  (selected.capper.user.username
                    ? `@${selected.capper.user.username.replace(/^@/, "")}`
                    : selected.capper.user.email)}
              </h2>
              <p className="text-muted-foreground mt-0.5 truncate text-xs">
                {selected.capper.user.username
                  ? `@${selected.capper.user.username.replace(/^@/, "")} · `
                  : ""}
                {selected.capper.user.email}
              </p>
              {selected.capper.user.username ? (
                <Link
                  href={`/cappers/${selected.capper.user.username.replace(/^@/, "")}`}
                  className="scl-link mt-1 inline-flex text-xs"
                >
                  View public profile ↗
                </Link>
              ) : null}
            </div>
            <StorefrontConversationPanel
              storeConnectionId={selected.id}
              viewer="admin"
              messages={threadMessages.map((message) => ({
                ...message,
                createdAt: message.createdAt.toISOString(),
              }))}
              provider={selected.provider}
              capperUsername={selected.capper.user.username}
            />
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="scl-display text-base font-bold tracking-[0.05em] uppercase">
                Request detail
              </h3>
              <ProviderBadge provider={selected.provider} />
              <StoreStatusChip status={selected.status} />
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {selected.provider === "WHOP"
                ? "Confirm the Whop affiliate relationship, sync or paste packages with ?a= links, set prices, activate, then Mark live. Packages stay private until Mark live."
                : "Accept the Winible affiliate invite off-platform, paste package checkout links (not the creator referral), activate, then Mark live. Packages stay private until Mark live."}
            </p>
            <ul className="space-y-2 text-sm">
              {adminStorefrontReadiness({
                provider: selected.provider,
                status: selected.status,
                packageCount: selected.packageCount,
                activePackageCount: selected.packages.filter(
                  (pkg) => pkg.isActive && pkg.checkoutUrl,
                ).length,
                affiliatePercent:
                  selected.affiliatePercent != null
                    ? Number(selected.affiliatePercent)
                    : null,
                whopConnected: Boolean(
                  selected.whopAccessToken && selected.whopCompanyId,
                ),
              }).map((item) => (
                <li key={item.label} className="flex gap-2">
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-bold",
                      item.done
                        ? "bg-pos/20 text-pos"
                        : "bg-surface-3 text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    {item.done ? "✓" : "·"}
                  </span>
                  <span
                    className={
                      item.done ? "text-foreground" : "text-muted-foreground"
                    }
                  >
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
            <div className="bg-surface-2 space-y-1 rounded-lg p-3 text-sm">
              <div className="flex justify-between">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Packages on connection
                </p>
                <span>{selected.packageCount}</span>
              </div>
              <div className="flex justify-between">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Affiliate %
                </p>
                <span>
                  {selected.affiliatePercent != null
                    ? `${Number(selected.affiliatePercent).toFixed(0)}%`
                    : "—"}
                </span>
              </div>
              {selected.affiliateAcceptedAt ? (
                <p className="text-muted-foreground text-xs">
                  Accepted: {selected.affiliateAcceptedAt.toLocaleString()}
                </p>
              ) : null}
              {selected.lastImportedAt ? (
                <p className="text-muted-foreground text-xs">
                  Last imported: {selected.lastImportedAt.toLocaleString()}
                </p>
              ) : null}
              {selected.whopConnectedAt ? (
                <p className="text-muted-foreground text-xs">
                  Whop app connected:{" "}
                  {selected.whopConnectedAt.toLocaleString()}
                </p>
              ) : null}
            </div>
            <div className="bg-surface-2 rounded-lg p-3 text-sm">
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Last human review
              </p>
              <p className="mt-1">
                {selected.reviewedAt
                  ? `${selected.reviewedBy?.displayName?.trim() || selected.reviewedBy?.username || selected.reviewedBy?.email || "Administrator"} · ${selected.reviewedAt.toLocaleString()}`
                  : "Not reviewed yet"}
              </p>
            </div>
            <AdminStoreActions
              key={selected.id}
              connectionId={selected.id}
              provider={selected.provider}
              currentStatus={selected.status}
              expectedUpdatedAt={selected.updatedAt.toISOString()}
              initialAdminNotes={selected.adminNotes}
              initialAffiliatePercent={
                selected.affiliatePercent != null
                  ? Number(selected.affiliatePercent)
                  : null
              }
              activePackageCount={
                selected.packages.filter(
                  (pkg) => pkg.isActive && pkg.checkoutUrl,
                ).length
              }
            />
            {selected.provider === "WHOP" ? (
              <AdminWhopSyncPanel
                connectionId={selected.id}
                whopConnected={Boolean(
                  selected.whopAccessToken && selected.whopCompanyId,
                )}
                syncConfigured={
                  whopOAuthConfigured() && Boolean(whopAffiliateUsername())
                }
                companyRoute={selected.whopCompanyRoute}
                connectedAt={selected.whopConnectedAt}
              />
            ) : null}
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

            <div className="space-y-3">
              <SectionHeader
                icon={History}
                title="Review History"
                subtitle="Append-only storefront decisions and package-readiness events"
              />
              {reviewHistory.length ? (
                <ol className="border-border divide-border divide-y overflow-hidden rounded-xl border">
                  {reviewHistory.map((event) => {
                    const actor =
                      event.reviewedBy.displayName?.trim() ||
                      event.reviewedBy.username ||
                      event.reviewedBy.email;
                    return (
                      <li key={event.id} className="bg-card space-y-2 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">
                            {storefrontReviewActionLabel(event.action)}
                          </span>
                          <StoreStatusChip status={event.previousStatus} />
                          <span aria-hidden>→</span>
                          <StoreStatusChip status={event.newStatus} />
                        </div>
                        {event.reason ? (
                          <p className="text-sm">{event.reason}</p>
                        ) : null}
                        {event.adminNotes ? (
                          <details className="text-sm">
                            <summary className="text-muted-foreground min-h-10 cursor-pointer text-xs font-semibold uppercase">
                              Notes snapshot
                            </summary>
                            <p className="bg-surface-2 mt-1 rounded-lg p-2 whitespace-pre-wrap">
                              {event.adminNotes}
                            </p>
                          </details>
                        ) : event.action === "NOTES_UPDATED" ? (
                          <p className="text-muted-foreground text-xs">
                            Internal notes cleared.
                          </p>
                        ) : null}
                        <p className="text-muted-foreground text-xs">
                          {actor} · {event.createdAt.toLocaleString()}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="border-border bg-surface-2 text-muted-foreground rounded-lg border p-3 text-sm">
                  No storefront review events have been recorded.
                </p>
              )}
            </div>
          </section>

          <section className="border-border bg-card space-y-4 rounded-xl border p-5">
            {/*
              What this capper already sells, before the form for adding more.
              The panel below only knows about packages on the connection being
              reviewed, so an admin approving a second provider — or any
              storefront for a carried-over capper, whose offers have no
              connection — would otherwise be told "no packages yet".
            */}
            <AdminCapperPackageInventory
              packages={capperPackages}
              currentConnectionId={selected.id}
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="scl-display text-base font-bold tracking-[0.05em] uppercase">
                Package object · {providerLabel(selected.provider)}
              </h2>
              <Button
                size="sm"
                variant="outline"
                className="min-h-10"
                render={
                  <Link
                    href={detailHref({
                      connectionId: selected.id,
                      packageId: "new",
                    })}
                  />
                }
                nativeButton={false}
              >
                New package
              </Button>
            </div>

            {selected.packages.length ? (
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Packages on this connection
                </p>
                <div className="space-y-2">
                  {selected.packages.map((pkg, index) => {
                    const clicks = pkg.trackingUrls[0]?._count?.clicks ?? 0;
                    const active =
                      !creatingNew && selectedPackage?.id === pkg.id;
                    return (
                      <div
                        key={pkg.id}
                        className={cn(
                          "border-border flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                          active
                            ? "border-brand/50 bg-brand/5"
                            : "hover:bg-surface-2",
                        )}
                      >
                        <Link
                          href={detailHref({
                            connectionId: selected.id,
                            packageId: pkg.id,
                          })}
                          className="flex min-w-0 flex-1 items-center justify-between gap-2"
                        >
                          <span className="min-w-0 truncate font-medium">
                            {pkg.title}
                          </span>
                          <span className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs tabular-nums">
                            <span>{clicks} clicks</span>
                            {(() => {
                              const pub = packagePublicationLabel({
                                isActive: pkg.isActive,
                                hasCheckout: Boolean(pkg.checkoutUrl),
                                connectionStatus: selected.status,
                                unattached: false,
                              });
                              return (
                                <span
                                  className={cn(
                                    "rounded-md px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide uppercase",
                                    pub.tone === "live" && "bg-pos/15 text-pos",
                                    pub.tone === "ready" &&
                                      "bg-amber-400/15 text-amber-300",
                                    pub.tone === "draft" &&
                                      "bg-surface-3 text-muted-foreground",
                                    pub.tone === "hidden" &&
                                      "bg-neg/10 text-neg",
                                  )}
                                >
                                  {pub.label}
                                </span>
                              );
                            })()}
                          </span>
                        </Link>
                        <AdminPackageRowControls
                          packageId={pkg.id}
                          title={pkg.title}
                          isActive={pkg.isActive}
                          isFirst={index === 0}
                          isLast={index === selected.packages.length - 1}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No packages yet. Create the first package object below.
              </p>
            )}

            <AdminPackageForm
              key={creatingNew ? "new" : selectedPackage?.id || "empty"}
              capperId={selected.capper.id}
              storeConnectionId={selected.id}
              provider={selected.provider}
              initial={
                creatingNew || !selectedPackage
                  ? null
                  : {
                      id: selectedPackage.id,
                      title: selectedPackage.title,
                      description: selectedPackage.description,
                      promoOffer: selectedPackage.promoOffer,
                      checkoutUrl: selectedPackage.checkoutUrl || "",
                      priceCents: selectedPackage.priceCents,
                      billingPeriod: selectedPackage.billingPeriod,
                      sortOrder: selectedPackage.sortOrder,
                      isActive: selectedPackage.isActive,
                      trackingSlug:
                        selectedPackage.trackingUrls[0]?.slug || null,
                      clickCount:
                        selectedPackage.trackingUrls[0]?._count?.clicks ?? 0,
                    }
              }
            />
          </section>
        </div>
      ) : null}

      <StorefrontCoveragePanel coverage={coverage} />
    </div>
  );
}
