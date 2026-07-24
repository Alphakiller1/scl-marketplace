"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateCapperCommerceAction } from "@/lib/actions/admin-sales.action";

export function CapperCommerceControl({
  capperProfileId,
  nativeStoreEnabled,
  defaultAffiliatePercent,
  platformEnabled,
}: {
  capperProfileId: string;
  nativeStoreEnabled: boolean;
  defaultAffiliatePercent: number | null;
  platformEnabled: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(nativeStoreEnabled);
  const [percent, setPercent] = useState(
    defaultAffiliatePercent == null ? "" : String(defaultAffiliatePercent),
  );
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    const result = await updateCapperCommerceAction({
      capperProfileId,
      nativeStoreEnabled: enabled,
      defaultAffiliatePercent: percent ? Number(percent) : null,
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Capper commerce settings updated");
    router.refresh();
  }

  return (
    <div className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-end">
      <label className="flex min-h-10 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          disabled={!platformEnabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className="accent-brand size-4"
        />
        <span>Native store</span>
      </label>
      <Input
        inputMode="numeric"
        value={percent}
        onChange={(event) => setPercent(event.target.value)}
        placeholder="Affiliate %"
        aria-label="Default affiliate percent"
      />
      <Button
        type="button"
        size="sm"
        disabled={pending || !platformEnabled}
        onClick={() => void save()}
      >
        <Save className="size-4" />
      </Button>
    </div>
  );
}
