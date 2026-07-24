"use client";

import { useState } from "react";
import type { CommercePlatform, StorefrontStatus } from "@prisma/client";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  COMMERCE_PLATFORM_LABEL,
  STOREFRONT_STATUS_LABEL,
} from "@/lib/commerce";
import { updateAdminStorefrontAction } from "@/lib/actions/admin-commerce.action";

const platformOptions = Object.entries(COMMERCE_PLATFORM_LABEL) as [
  CommercePlatform,
  string,
][];
const statusOptions = Object.entries(STOREFRONT_STATUS_LABEL) as [
  StorefrontStatus,
  string,
][];

export function StorefrontAdminControl({
  capperProfileId,
  commercePlatform,
  storefrontStatus,
  adminNotes,
}: {
  capperProfileId: string;
  commercePlatform: CommercePlatform;
  storefrontStatus: StorefrontStatus;
  adminNotes?: string | null;
}) {
  const router = useRouter();
  const [platform, setPlatform] = useState(commercePlatform);
  const [status, setStatus] = useState(storefrontStatus);
  const [notes, setNotes] = useState(adminNotes ?? "");
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    const result = await updateAdminStorefrontAction({
      capperProfileId,
      commercePlatform: platform,
      storefrontStatus: status,
      adminNotes: notes,
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Storefront updated");
    router.refresh();
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground font-medium">Platform</span>
          <select
            value={platform}
            onChange={(event) =>
              setPlatform(event.target.value as CommercePlatform)
            }
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 min-h-10 rounded-lg border px-2.5 outline-none focus-visible:ring-3"
          >
            {platformOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground font-medium">Status</span>
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as StorefrontStatus)
            }
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 min-h-10 rounded-lg border px-2.5 outline-none focus-visible:ring-3"
          >
            {statusOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="grid gap-1.5 text-sm">
        <span className="text-muted-foreground font-medium">
          Internal notes
        </span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Affiliate invite sent on Winible, waiting on checkout link verification..."
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 rounded-lg border px-3 py-2 outline-none focus-visible:ring-3"
        />
      </label>
      <Button type="button" disabled={pending} onClick={() => void save()}>
        <Save className="size-4" />
        Save storefront review
      </Button>
    </div>
  );
}
