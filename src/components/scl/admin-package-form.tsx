"use client";

import { useState, useTransition } from "react";
import type { BillingPeriod, StoreProvider } from "@prisma/client";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminSavePackageAction } from "@/lib/actions/store.action";
import { providerLabel } from "@/lib/store-connection";
import { cn } from "@/lib/utils";

export function AdminPackageForm({
  capperId,
  storeConnectionId,
  provider,
  initial,
}: {
  capperId: string;
  storeConnectionId?: string | null;
  provider: StoreProvider;
  initial?: {
    id: string;
    title: string;
    description: string | null;
    checkoutUrl: string | null;
    priceCents: number;
    billingPeriod: BillingPeriod;
    isActive: boolean;
    trackingSlug?: string | null;
  } | null;
}) {
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [checkoutUrl, setCheckoutUrl] = useState(initial?.checkoutUrl || "");
  const [priceDollars, setPriceDollars] = useState(
    initial ? String((initial.priceCents / 100).toFixed(2)) : "",
  );
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>(
    initial?.billingPeriod || "MONTH",
  );
  const [isActive, setIsActive] = useState(initial?.isActive ?? false);
  const [packageId, setPackageId] = useState(initial?.id || "");
  const trackingSlug = initial?.trackingSlug || "";
  const [pending, startTransition] = useTransition();

  function save(publish: boolean) {
    const cents = Math.round(Number.parseFloat(priceDollars || "0") * 100);
    startTransition(async () => {
      const res = await adminSavePackageAction({
        id: packageId || undefined,
        capperId,
        storeConnectionId: storeConnectionId || null,
        affiliateProvider: provider,
        title,
        description,
        checkoutUrl,
        priceCents: Number.isFinite(cents) ? Math.max(0, cents) : 0,
        billingPeriod,
        isActive: publish ? true : isActive,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.packageId) setPackageId(res.packageId);
      if (publish) setIsActive(true);
      toast.success(publish ? "Package published" : "Package saved");
      // Tracking slug is generated server-side; reload to refresh queue detail.
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
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="provider">Provider</Label>
          <Input id="provider" value={providerLabel(provider)} readOnly />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="billing">Billing period</Label>
          <select
            id="billing"
            className="border-border bg-background h-10 w-full rounded-md border px-3 text-sm"
            value={billingPeriod}
            onChange={(e) => setBillingPeriod(e.target.value as BillingPeriod)}
          >
            <option value="ONE_TIME">One time</option>
            <option value="DAY">Day</option>
            <option value="WEEK">Week</option>
            <option value="MONTH">Month</option>
            <option value="SEASON">Season</option>
            <option value="YEAR">Year</option>
          </select>
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
        <Label htmlFor="desc">Description</Label>
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
        <Label htmlFor="dest">
          Provider destination URL (
          {provider === "WHOP" ? "product-specific" : "package"} affiliate link)
        </Label>
        <Input
          id="dest"
          type="url"
          value={checkoutUrl}
          onChange={(e) => setCheckoutUrl(e.target.value)}
          placeholder={
            provider === "WHOP"
              ? "Paste Whop product-specific affiliate link"
              : "Paste Winible package affiliate link"
          }
          required
        />
        <p className="text-muted-foreground text-xs">
          Admin-only. Cappers never paste affiliate links.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="track">SCL tracking URL</Label>
        <Input
          id="track"
          readOnly
          value={trackingSlug ? `/go/${trackingSlug}` : "Generated on save"}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="price">Display price (USD)</Label>
          <Input
            id="price"
            inputMode="decimal"
            value={priceDollars}
            onChange={(e) => setPriceDollars(e.target.value)}
            placeholder="99.00"
          />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="size-4 accent-[color:var(--scl-pink)]"
          />
          Live on profile
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} className="min-h-11">
          Save package
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          className="min-h-11"
          onClick={() => save(true)}
        >
          Save & publish
        </Button>
      </div>
    </form>
  );
}
