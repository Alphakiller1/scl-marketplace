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
  companyRoute,
  connectedAt,
}: {
  connectionId: string;
  whopConnected: boolean;
  syncConfigured: boolean;
  companyRoute?: string | null;
  connectedAt?: Date | string | null;
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
        `Whop sync complete — ${result.imported} imported, ${result.updated} updated${result.skipped ? `, ${result.skipped} skipped` : ""}. Set prices, activate packages, then Mark live.`,
      );
      router.refresh();
    });
  }

  const connectedLabel =
    connectedAt != null ? new Date(connectedAt).toLocaleString() : null;

  return (
    <div className="border-border bg-surface-2 space-y-2 rounded-xl border p-4">
      <p className="text-sm font-semibold">Whop package sync</p>
      <p className="text-muted-foreground text-xs leading-relaxed">
        {syncConfigured
          ? whopConnected
            ? "Pull visible products from the capper's Whop business into draft packages with attributed checkout links (?a=). Sync never publishes — activate + Mark live still required."
            : "Waiting on the capper to install the SCL app from Dashboard → Storefront."
          : "Whop OAuth is not fully configured on the server yet."}
      </p>
      {whopConnected ? (
        <p className="text-muted-foreground text-xs">
          {companyRoute ? (
            <>
              Connected business:{" "}
              <span className="text-foreground font-medium">
                whop.com/{companyRoute}
              </span>
            </>
          ) : (
            "Connected business route unavailable."
          )}
          {connectedLabel ? ` · ${connectedLabel}` : null}
        </p>
      ) : null}
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
