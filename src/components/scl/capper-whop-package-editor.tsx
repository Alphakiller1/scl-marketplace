"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { capperUpdateWhopPackageAction } from "@/lib/actions/store.action";
import type { OwnerWhopPackage } from "@/lib/queries/store";

export function CapperWhopPackageEditor({ pkg }: { pkg: OwnerWhopPackage }) {
  const router = useRouter();
  const [title, setTitle] = useState(pkg.title);
  const [description, setDescription] = useState(pkg.description ?? "");
  const [isActive, setIsActive] = useState(pkg.isActive);
  const [pending, startTransition] = useTransition();
  const fieldSuffix = pkg.id.replace(/[^a-zA-Z0-9_-]/g, "");

  function save() {
    startTransition(async () => {
      const result = await capperUpdateWhopPackageAction({
        packageId: pkg.id,
        expectedUpdatedAt: pkg.updatedAt,
        title,
        description,
        isActive,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Package saved. Whop sync queued.");
      router.refresh();
    });
  }

  return (
    <article className="border-border bg-card space-y-4 rounded-xl border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="scl-eyebrow text-[color:var(--scl-muted-data)]">
            Whop · {pkg.isActive ? "Live" : "Hidden"}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Price: {pkg.priceLabel}. Change pricing and billing on Whop.
          </p>
        </div>
        {pkg.syncPending ? (
          <span className="bg-brand/10 text-foreground rounded-full px-2.5 py-1 text-xs font-semibold">
            Sync queued
          </span>
        ) : pkg.syncFailed ? (
          <span className="bg-destructive/10 text-foreground rounded-full px-2.5 py-1 text-xs font-semibold">
            Retrying sync
          </span>
        ) : (
          <span className="bg-surface-2 text-muted-foreground rounded-full px-2.5 py-1 text-xs font-semibold">
            Synced
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`whop-title-${fieldSuffix}`}>Package name</Label>
        <Input
          id={`whop-title-${fieldSuffix}`}
          value={title}
          minLength={2}
          maxLength={80}
          required
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`whop-description-${fieldSuffix}`}>Description</Label>
        <textarea
          id={`whop-description-${fieldSuffix}`}
          className="border-input bg-background focus-visible:ring-ring/50 min-h-24 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2"
          value={description}
          maxLength={2000}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <label
        htmlFor={`whop-active-${fieldSuffix}`}
        className="border-border bg-surface-2 flex cursor-pointer items-center justify-between gap-4 rounded-lg border p-3"
      >
        <span>
          <span className="text-foreground block text-sm font-semibold">
            Visible for purchase
          </span>
          <span className="text-muted-foreground block text-xs">
            Turning this off hides the product on both SCL and Whop.
          </span>
        </span>
        <input
          id={`whop-active-${fieldSuffix}`}
          type="checkbox"
          className="h-5 w-5 accent-[var(--scl-blue)]"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
        />
      </label>

      <Button
        type="button"
        disabled={pending || title.trim().length < 2}
        onClick={save}
      >
        {pending ? "Saving…" : "Save and sync to Whop"}
      </Button>
    </article>
  );
}
