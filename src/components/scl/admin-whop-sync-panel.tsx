"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { adminSyncWhopStorefrontAction } from "@/lib/actions/store.action";

export function AdminWhopSyncPanel({
  connectionId,
  whopConnected,
  syncConfigured,
}: {
  connectionId: string;
  whopConnected: boolean;
  syncConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function sync() {
    startTransition(async () => {
      const result = await adminSyncWhopStorefrontAction({ connectionId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Whop sync complete — ${result.imported} imported, ${result.updated} updated${result.skipped ? `, ${result.skipped} skipped` : ""}.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="border-border bg-surface-2 space-y-2 rounded-xl border p-4">
      <p className="text-sm font-semibold">Whop package sync</p>
      <p className="text-muted-foreground text-xs leading-relaxed">
        {syncConfigured
          ? whopConnected
            ? "Pull visible products from the capper's Whop business and draft package rows with attributed checkout links."
            : "Waiting on the capper to install the SCL app from Dashboard → Storefront."
          : "Set WHOP_APP_ID, WHOP_APP_API_KEY, and WHOP_AFFILIATE_USERNAME in production before sync is available."}
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="min-h-10"
        disabled={pending || !syncConfigured || !whopConnected}
        onClick={sync}
      >
        <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} />
        Sync from Whop
      </Button>
    </div>
  );
}
