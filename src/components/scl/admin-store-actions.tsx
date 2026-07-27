"use client";

import { useState, useTransition } from "react";
import type { StoreConnectionStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { adminUpdateStoreConnectionAction } from "@/lib/actions/store.action";
import {
  storefrontActionRequiresReason,
  storefrontTransition,
  type AdminStorefrontAction,
} from "@/lib/storefront-review";

export function AdminStoreActions({
  connectionId,
  currentStatus,
  expectedUpdatedAt,
  initialAdminNotes,
}: {
  connectionId: string;
  currentStatus: StoreConnectionStatus;
  expectedUpdatedAt: string;
  initialAdminNotes: string | null;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [adminNotes, setAdminNotes] = useState(initialAdminNotes ?? "");
  const [pending, startTransition] = useTransition();
  const notesChanged = adminNotes !== (initialAdminNotes ?? "");

  function allowed(action: AdminStorefrontAction): boolean {
    return storefrontTransition(currentStatus, action) !== null;
  }

  function run(action: AdminStorefrontAction) {
    if (storefrontActionRequiresReason(action) && reason.trim().length < 5) {
      toast.error("Add a reason of at least 5 characters.");
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
        });
        if (!result.ok) {
          toast.error(result.error);
          router.refresh();
          return;
        }

        toast.success(
          action === "SAVE_NOTES"
            ? "Internal notes saved"
            : "Storefront review recorded",
        );
        setReason("");
        router.refresh();
      } catch {
        toast.error("The storefront update could not be saved. Try again.");
      }
    });
  }

  return (
    <div className="border-border space-y-4 rounded-xl border p-4">
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
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs">
            Saving notes creates an immutable review event.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || !notesChanged}
            onClick={() => run("SAVE_NOTES")}
          >
            Save notes
          </Button>
        </div>
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
          Approve storefront
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="min-h-10"
          disabled={pending || !allowed("MARK_LIVE")}
          onClick={() => run("MARK_LIVE")}
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
    </div>
  );
}
