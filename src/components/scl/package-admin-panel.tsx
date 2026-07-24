"use client";

import { useMemo, useState } from "react";
import type { BillingPeriod, PackageVisibility } from "@prisma/client";
import { Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BILLING_PERIOD_LABEL,
  PACKAGE_VISIBILITY_LABEL,
  formatPackagePrice,
} from "@/lib/commerce";
import {
  deleteAdminPackageAction,
  upsertAdminPackageAction,
} from "@/lib/actions/admin-commerce.action";
import type { AdminStorefrontDetail } from "@/lib/queries/admin-storefronts";

type PackageRow = AdminStorefrontDetail["packages"][number];

const billingOptions = Object.entries(BILLING_PERIOD_LABEL) as [
  BillingPeriod,
  string,
][];
const visibilityOptions = Object.entries(PACKAGE_VISIBILITY_LABEL) as [
  PackageVisibility,
  string,
][];

const emptyDraft = {
  title: "",
  description: "",
  priceDollars: "0",
  billingPeriod: "MONTH" as BillingPeriod,
  checkoutUrl: "",
  trialTerms: "",
  displayOrder: "0",
  visibility: "DRAFT" as PackageVisibility,
  affiliatePercent: "",
};

export function PackageAdminPanel({
  capperProfileId,
  packages,
}: {
  capperProfileId: string;
  packages: PackageRow[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const editingPackage = useMemo(
    () => packages.find((pkg) => pkg.id === editingId) ?? null,
    [editingId, packages],
  );

  function loadPackage(pkg: PackageRow) {
    setEditingId(pkg.id);
    setDraft({
      title: pkg.title,
      description: pkg.description ?? "",
      priceDollars: (pkg.priceCents / 100).toFixed(
        pkg.priceCents % 100 === 0 ? 0 : 2,
      ),
      billingPeriod: pkg.billingPeriod,
      checkoutUrl: pkg.checkoutUrl ?? "",
      trialTerms: pkg.trialTerms ?? "",
      displayOrder: String(pkg.displayOrder),
      visibility: pkg.visibility,
      affiliatePercent:
        pkg.affiliatePercent == null ? "" : String(pkg.affiliatePercent),
    });
  }

  function resetDraft() {
    setEditingId(null);
    setDraft(emptyDraft);
  }

  async function savePackage() {
    setPending(true);
    const priceCents = Math.round(Number(draft.priceDollars || "0") * 100);
    const result = await upsertAdminPackageAction({
      id: editingId ?? undefined,
      capperProfileId,
      title: draft.title,
      description: draft.description,
      priceCents,
      billingPeriod: draft.billingPeriod,
      checkoutUrl: draft.checkoutUrl,
      trialTerms: draft.trialTerms,
      displayOrder: Number(draft.displayOrder || "0"),
      visibility: draft.visibility,
      affiliatePercent: draft.affiliatePercent
        ? Number(draft.affiliatePercent)
        : null,
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(editingId ? "Package updated" : "Package created");
    resetDraft();
    router.refresh();
  }

  async function removePackage(packageId: string) {
    if (!window.confirm("Remove this package from SCL?")) return;
    setPending(true);
    const result = await deleteAdminPackageAction({ packageId });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Package removed");
    if (editingId === packageId) resetDraft();
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <div className="border-border divide-border divide-y overflow-hidden rounded-xl border">
        {packages.length ? (
          packages.map((pkg) => (
            <article
              key={pkg.id}
              className="bg-card flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{pkg.title}</h3>
                  <span className="text-muted-foreground text-xs uppercase">
                    {PACKAGE_VISIBILITY_LABEL[pkg.visibility]}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 text-sm">
                  {formatPackagePrice(pkg.priceCents, pkg.billingPeriod)}
                  {pkg.trialTerms ? ` · ${pkg.trialTerms}` : ""}
                </p>
                <p className="text-muted-foreground mt-1 truncate text-xs">
                  {pkg.trackingUrls[0]?.slug
                    ? `/go/${pkg.trackingUrls[0].slug}`
                    : "No tracking link yet"}
                  {" · "}
                  {pkg.trackingUrls.reduce(
                    (sum, url) => sum + url._count.clicks,
                    0,
                  )}{" "}
                  clicks
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => loadPackage(pkg)}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => void removePackage(pkg.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </article>
          ))
        ) : (
          <p className="text-muted-foreground p-4 text-sm">
            No packages yet. Add the first approved checkout link below after
            affiliate setup on Winible or Whop.
          </p>
        )}
      </div>

      <div className="border-border bg-surface-2 rounded-xl border p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">
              {editingPackage ? "Edit package" : "Add package"}
            </h3>
            <p className="text-muted-foreground text-sm">
              Manual entry after affiliate approval on the third-party platform.
            </p>
          </div>
          {editingPackage ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetDraft}
            >
              Cancel edit
            </Button>
          ) : (
            <Plus className="text-muted-foreground size-4" aria-hidden />
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm sm:col-span-2">
            <span className="text-muted-foreground font-medium">Name</span>
            <Input
              value={draft.title}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, title: event.target.value }))
              }
              placeholder="Weekly MLB package"
            />
          </label>
          <label className="grid gap-1.5 text-sm sm:col-span-2">
            <span className="text-muted-foreground font-medium">
              Description
            </span>
            <textarea
              value={draft.description}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              rows={3}
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 rounded-lg border px-3 py-2 outline-none focus-visible:ring-3"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground font-medium">
              Price (USD)
            </span>
            <Input
              inputMode="decimal"
              value={draft.priceDollars}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  priceDollars: event.target.value,
                }))
              }
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground font-medium">Billing</span>
            <select
              value={draft.billingPeriod}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  billingPeriod: event.target.value as BillingPeriod,
                }))
              }
              className="border-input bg-background min-h-10 rounded-lg border px-2.5 text-sm"
            >
              {billingOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm sm:col-span-2">
            <span className="text-muted-foreground font-medium">
              Checkout link
            </span>
            <Input
              value={draft.checkoutUrl}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  checkoutUrl: event.target.value,
                }))
              }
              placeholder="https://winible.com/..."
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground font-medium">
              Trial terms
            </span>
            <Input
              value={draft.trialTerms}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  trialTerms: event.target.value,
                }))
              }
              placeholder="7-day trial"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground font-medium">
              Display order
            </span>
            <Input
              inputMode="numeric"
              value={draft.displayOrder}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  displayOrder: event.target.value,
                }))
              }
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground font-medium">
              Visibility
            </span>
            <select
              value={draft.visibility}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  visibility: event.target.value as PackageVisibility,
                }))
              }
              className="border-input bg-background min-h-10 rounded-lg border px-2.5 text-sm"
            >
              {visibilityOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground font-medium">
              Affiliate %
            </span>
            <Input
              inputMode="numeric"
              value={draft.affiliatePercent}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  affiliatePercent: event.target.value,
                }))
              }
              placeholder="Optional"
            />
          </label>
        </div>

        <Button
          type="button"
          className="mt-4"
          disabled={pending}
          onClick={() => void savePackage()}
        >
          <Save className="size-4" />
          {editingPackage ? "Save package" : "Add package"}
        </Button>
      </div>
    </div>
  );
}
