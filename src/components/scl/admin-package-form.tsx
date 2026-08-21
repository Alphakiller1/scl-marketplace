"use client";

import { useState, useTransition } from "react";
import type { BillingPeriod, StoreProvider } from "@prisma/client";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  adminSavePackageAction,
  adminSetPackageActiveAction,
} from "@/lib/actions/store.action";
import { formatPriceCents, providerLabel } from "@/lib/store-connection";
import { cn } from "@/lib/utils";

export type AdminPackageInitial = {
  id: string;
  title: string;
  description: string | null;
  promoOffer?: string | null;
  checkoutUrl: string | null;
  priceCents: number;
  billingPeriod: BillingPeriod;
  billingIntervalCount?: number;
  sortOrder?: number;
  isActive: boolean;
  trackingSlug?: string | null;
  clickCount?: number;
};

export function AdminPackageForm({
  capperId,
  storeConnectionId,
  provider,
  allowProviderSelection = false,
  initial,
}: {
  capperId: string;
  storeConnectionId?: string | null;
  provider: StoreProvider;
  /** New manual packages can choose either provider without an API connection. */
  allowProviderSelection?: boolean;
  initial?: AdminPackageInitial | null;
}) {
  const [selectedProvider, setSelectedProvider] =
    useState<StoreProvider>(provider);
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [promoOffer, setPromoOffer] = useState(initial?.promoOffer || "");
  const [checkoutUrl, setCheckoutUrl] = useState(initial?.checkoutUrl || "");
  const [priceDollars, setPriceDollars] = useState(
    initial ? String((initial.priceCents / 100).toFixed(2)) : "",
  );
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>(
    initial?.billingPeriod || "MONTH",
  );
  const [billingIntervalCount, setBillingIntervalCount] = useState(
    initial?.billingIntervalCount ?? 1,
  );
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(initial?.isActive ?? false);
  const [packageId, setPackageId] = useState(initial?.id || "");
  // ONE_TIME and SEASON have no repeat count; the input is disabled and pinned
  // to 1 for them rather than submitting a stale value from a previous choice.
  const countableBilling =
    billingPeriod !== "ONE_TIME" && billingPeriod !== "SEASON";
  const priceCents = Math.round(
    Number.parseFloat(priceDollars || "0") * 100 || 0,
  );
  const trackingSlug = initial?.trackingSlug || "";
  const clickCount = initial?.clickCount ?? 0;
  const [pending, startTransition] = useTransition();

  function save(publish: boolean) {
    const cents = Math.round(Number.parseFloat(priceDollars || "0") * 100);
    const order = Number.parseInt(sortOrder || "0", 10);
    const wasCreate = !packageId;
    startTransition(async () => {
      const res = await adminSavePackageAction({
        id: packageId || undefined,
        capperId,
        // Provider-selectable manual creation resolves the matching connection
        // on the server. It remains unattached when no connection exists.
        storeConnectionId: allowProviderSelection
          ? null
          : storeConnectionId || null,
        affiliateProvider: selectedProvider,
        title,
        description,
        promoOffer,
        checkoutUrl,
        priceCents: Number.isFinite(cents) ? Math.max(0, cents) : 0,
        billingPeriod,
        billingIntervalCount: countableBilling ? billingIntervalCount : 1,
        sortOrder: Number.isFinite(order) ? Math.max(0, order) : 0,
        isActive: publish ? true : isActive,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.packageId) setPackageId(res.packageId);
      if (publish) setIsActive(true);
      toast.success(publish ? "Package saved and activated" : "Package saved");
      // After create, leave ?packageId=new so the new package opens for edit.
      if (wasCreate && res.packageId) {
        const url = new URL(window.location.href);
        url.searchParams.set("packageId", res.packageId);
        window.location.assign(url.toString());
        return;
      }
      window.location.reload();
    });
  }

  function setActive(next: boolean) {
    if (!packageId) {
      setIsActive(next);
      return;
    }
    startTransition(async () => {
      const res = await adminSetPackageActiveAction({
        packageId,
        isActive: next,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setIsActive(next);
      toast.success(next ? "Package activated" : "Package deactivated");
      window.location.reload();
    });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save(false);
      }}
    >
      <p className="text-muted-foreground text-xs leading-relaxed">
        Manual package setup for {providerLabel(selectedProvider)}. This path
        does not require a working provider API. Paste the package link, then
        fill in the name, price, promo details, and description once — SCL
        generates the public card and CTA automatically.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="provider">Platform</Label>
          {allowProviderSelection ? (
            <select
              id="provider"
              className="border-border bg-background h-10 w-full rounded-md border px-3 text-sm"
              value={selectedProvider}
              onChange={(event) =>
                setSelectedProvider(event.target.value as StoreProvider)
              }
            >
              <option value="WHOP">Whop</option>
              <option value="WINIBLE">Winible</option>
            </select>
          ) : (
            <Input
              id="provider"
              value={providerLabel(selectedProvider)}
              readOnly
            />
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="billing">Billing cadence</Label>
          <div className="flex gap-2">
            {/* Every/N: a term is a COUNT of units, so 4 days and 5 days are
                reachable without inventing an enum member for each. */}
            <Input
              id="billingCount"
              type="number"
              min={1}
              max={365}
              step={1}
              className="h-10 w-20"
              aria-label="Number of billing periods"
              value={countableBilling ? billingIntervalCount : 1}
              disabled={!countableBilling}
              onChange={(e) =>
                setBillingIntervalCount(
                  Math.max(1, Number(e.target.value) || 1),
                )
              }
            />
            <select
              id="billing"
              className="border-border bg-background h-10 w-full rounded-md border px-3 text-sm"
              value={billingPeriod}
              onChange={(e) => {
                const next = e.target.value as BillingPeriod;
                setBillingPeriod(next);
                // A count is meaningless for these two; reset so a stale 4 can
                // never be submitted alongside them.
                if (next === "ONE_TIME" || next === "SEASON") {
                  setBillingIntervalCount(1);
                }
              }}
            >
              <option value="ONE_TIME">One time</option>
              <option value="DAY">
                {billingIntervalCount > 1 ? "Days" : "Day"}
              </option>
              <option value="WEEK">
                {billingIntervalCount > 1 ? "Weeks" : "Week"}
              </option>
              <option value="MONTH">
                {billingIntervalCount > 1 ? "Months" : "Month"}
              </option>
              <option value="SEASON">Season</option>
              <option value="YEAR">
                {billingIntervalCount > 1 ? "Years" : "Year"}
              </option>
            </select>
          </div>
          <p className="text-muted-foreground text-xs">
            {priceCents > 0
              ? `Reads as ${formatPriceCents(priceCents, billingPeriod, countableBilling ? billingIntervalCount : 1)}`
              : "Set a price to preview how the cadence reads."}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="title">Package name</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="dest">
          {selectedProvider === "WINIBLE"
            ? "Winible storefront/package link"
            : "Whop storefront/package link"}
        </Label>
        <Input
          id="dest"
          type="url"
          value={checkoutUrl}
          onChange={(e) => setCheckoutUrl(e.target.value)}
          placeholder={
            selectedProvider === "WHOP"
              ? "Paste Whop product-specific link"
              : "Paste Winible storefront or package link"
          }
          required
        />
        <p className="text-muted-foreground text-xs">
          Admin-only destination. Public CTAs always use the SCL tracking URL,
          so you can publish the package without exposing the raw affiliate
          link.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="track">SCL tracking URL</Label>
          <Input
            id="track"
            readOnly
            value={trackingSlug ? `/go/${trackingSlug}` : "Generated on save"}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="clicks">Tracked clicks</Label>
          <Input
            id="clicks"
            readOnly
            value={packageId ? String(clickCount) : "—"}
            className="tabular-nums"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="desc">Package description</Label>
        <textarea
          id="desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={cn(
            "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 min-h-24 w-full rounded-lg border bg-transparent px-3 py-2 text-base outline-none focus-visible:ring-3",
          )}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="promo">Free trial / introductory offer</Label>
        <Input
          id="promo"
          value={promoOffer}
          onChange={(e) => setPromoOffer(e.target.value)}
          placeholder="e.g. 7-day free trial · first month 50% off"
        />
        <p className="text-muted-foreground text-xs">
          Optional. Shown on the standardized package card when set.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="price">Price (USD)</Label>
          <Input
            id="price"
            inputMode="decimal"
            value={priceDollars}
            onChange={(e) => setPriceDollars(e.target.value)}
            placeholder="99.00"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="order">Display order</Label>
          <Input
            id="order"
            inputMode="numeric"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            placeholder="0"
          />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setActive(e.target.checked)}
            className="size-4 accent-[color:var(--scl-pink)]"
          />
          Package active
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          Save package
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => save(true)}
        >
          Save & activate
        </Button>
        {packageId ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => setActive(false)}
          >
            Deactivate
          </Button>
        ) : null}
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        Activate prepares this package for publication. Manual packages created
        here stay unattached from pending storefront workflows, so an active
        offer with a Whop link can appear on the public profile immediately.
        Packages created inside a storefront review stay tied to that connection
        and need <strong>Mark live</strong> before they publish.
      </p>
    </form>
  );
}
