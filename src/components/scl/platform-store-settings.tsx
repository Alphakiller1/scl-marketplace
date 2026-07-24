"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updatePlatformCommerceAction } from "@/lib/actions/admin-sales.action";

export function PlatformStoreSettings({
  nativeStoreEnabled,
  platformAffiliatePercent,
}: {
  nativeStoreEnabled: boolean;
  platformAffiliatePercent: number;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(nativeStoreEnabled);
  const [percent, setPercent] = useState(String(platformAffiliatePercent));
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    const result = await updatePlatformCommerceAction({
      nativeStoreEnabled: enabled,
      platformAffiliatePercent: Number(percent || "20"),
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Platform store settings updated");
    router.refresh();
  }

  return (
    <div className="border-border bg-card space-y-4 rounded-xl border p-4">
      <div>
        <h3 className="font-semibold">SCL native store</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Global kill switch for SCL-hosted checkout and the default affiliate
          split when package-level percentages are unset.
        </p>
      </div>
      <label className="flex min-h-10 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className="accent-brand size-4"
        />
        <span>Platform native store enabled</span>
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="text-muted-foreground font-medium">
          Default affiliate %
        </span>
        <Input
          inputMode="numeric"
          value={percent}
          onChange={(event) => setPercent(event.target.value)}
        />
      </label>
      <Button type="button" disabled={pending} onClick={() => void save()}>
        <Save className="size-4" />
        Save platform settings
      </Button>
    </div>
  );
}
