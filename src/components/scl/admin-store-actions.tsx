"use client";

import { useState, useTransition } from "react";
import type { StoreConnectionStatus, StoreProvider } from "@prisma/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminUpdateStoreConnectionAction } from "@/lib/actions/store.action";
import {
  adminActionSuccessMessage,
  adminApproveLabel,
  storefrontGoLiveGate,
} from "@/lib/storefront-ops";
import {
  storefrontActionRequiresReason,
  storefrontTransition,
  type AdminStorefrontAction,
} from "@/lib/storefront-review";

export function AdminStoreActions({
  connectionId,
  provider,
  currentStatus,
  expectedUpdatedAt,
  initialAdminNotes,
  initialAffiliatePercent,
  activePackageCount,
}: {
  connectionId: string;
  provider: StoreProvider;
  currentStatus: StoreConnectionStatus;
  expectedUpdatedAt: string;
  initialAdminNotes: string | null;
  initialAffiliatePercent: number | null;
  activePackageCount: number;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [adminNotes, setAdminNotes] = useState(initialAdminNotes ?? "");
  const [affiliatePercent, setAffiliatePercent] = useState(
    initialAffiliatePercent != null ? String(initialAffiliatePercent) : "",
  );
  const [pending, startTransition] = useTransition();
  const notesChanged = adminNotes !== (initialAdminNotes ?? "");
  const percentChanged =
    (affiliatePercent.trim() === ""
      ? null
      : Number(affiliatePercent.trim())) !== initialAffiliatePercent;
  const goLive = storefrontGoLiveGate({
    status: currentStatus,
    activePackageCount,
  });

  function allowed(action: AdminStorefrontAction): boolean {
    return storefrontTransition(currentStatus, action) !== null;
  }

  function parsedPercent(): number | null | undefined {
    if (!percentChanged) return undefined;
    const trimmed = affiliatePercent.trim();
    if (!trimmed) return null;
    const value = Number(trimmed);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      toast.error("Affiliate % must be a number from 0 to 100.");
      return undefined;
    }
    return value;
  }

  function run(action: AdminStorefrontAction) {
    if (storefrontActionRequiresReason(action) && reason.trim().length < 5) {
      toast.error("Add a reason of at least 5 characters.");
      return;
    }

    const percent = parsedPercent();
    if (percentChanged && percent === undefined && affiliatePercent.trim()) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await adminUpdateStoreConnectionAction({
          connectionId,
          action,
          expectedStatus: currentStatus,
          expectedUpdatedAt,
          reason,
          adminNotes,
          affiliatePercent: percent,
        });
        if (!result.ok) {
          toast.error(result.error);
          router.refresh();
          return;
        }

        toast.success(adminActionSuccessMessage(action, provider));
        setReason("");
        router.refresh();
      } catch {
        toast.error("The storefront update could not be saved. Try again.");
      }
    });
  }

  return (
    <div className="border-border space-y-4 rounded-xl border p-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <div>
          <label
            htmlFor={`store-admin-notes-${connectionId}`}
            className="text-sm font-semibold"
          >
            Internal notes
          </label>
          <textarea
            id={`store-admin-notes-${connectionId}`}
            value={adminNotes}
            onChange={(event) => setAdminNotes(event.target.value)}
            maxLength={2000}
            rows={4}
            disabled={pending}
            className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 mt-1.5 min-h-24 w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-3"
            placeholder="Provider correspondence, package-link checks, or follow-up details."
          />
        </div>
        <div>
          <label
            htmlFor={`store-affiliate-percent-${connectionId}`}
            className="text-sm font-semibold"
          >
            Affiliate %
          </label>
          <Input
            id={`store-affiliate-percent-${connectionId}`}
            type="number"
            min={0}
            max={100}
            step={1}
            inputMode="decimal"
            value={affiliatePercent}
            onChange={(event) => setAffiliatePercent(event.target.value)}
            disabled={pending}
            className="mt-1.5"
            placeholder="35"
          />
          <p className="text-muted-foreground mt-1 text-xs">
            Commission agreed on {provider === "WHOP" ? "Whop" : "Winible"}.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          Saving notes or % creates an immutable review event.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending || (!notesChanged && !percentChanged)}
          onClick={() => run("SAVE_NOTES")}
        >
          Save notes
        </Button>
      </div>

      <div>
        <label
          htmlFor={`store-action-reason-${connectionId}`}
          className="text-sm font-semibold"
        >
          Action reason
        </label>
        <textarea
          id={`store-action-reason-${connectionId}`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          rows={3}
          disabled={pending}
          className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 mt-1.5 min-h-20 w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-3"
          placeholder="Required for changes requested, suspension, and restoration."
        />
        <p className="text-muted-foreground mt-1 text-xs">
          Suspensions remove this storefront’s packages from public publication.
          Restoration returns it to Needs Action for a fresh review.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="min-h-10"
          disabled={pending || !allowed("APPROVE")}
          onClick={() => run("APPROVE")}
        >
          {adminApproveLabel(provider)}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="min-h-10"
          disabled={pending || !allowed("MARK_LIVE") || !goLive.canMarkLive}
          onClick={() => run("MARK_LIVE")}
          title={
            !goLive.canMarkLive ? goLive.reasons.join(" ") : "Publish packages"
          }
        >
          Mark live
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-10"
          disabled={pending || !allowed("REQUEST_CHANGES")}
          onClick={() => run("REQUEST_CHANGES")}
        >
          Request changes
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="min-h-10"
          disabled={pending || !allowed("SUSPEND")}
          onClick={() => run("SUSPEND")}
        >
          Suspend storefront
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-10"
          disabled={pending || !allowed("RESTORE")}
          onClick={() => run("RESTORE")}
        >
          Restore for review
        </Button>
      </div>
      {!goLive.canMarkLive && allowed("MARK_LIVE") ? (
        <p className="text-muted-foreground text-xs leading-relaxed">
          {goLive.reasons.join(" ")}
        </p>
      ) : null}
      {allowed("APPROVE") ? (
        <p className="text-muted-foreground text-xs leading-relaxed">
          Confirm only after the affiliate relationship is live on{" "}
          {provider === "WHOP" ? "Whop" : "Winible"}. Packages stay private
          until Mark live.
        </p>
      ) : null}
    </div>
  );
}
