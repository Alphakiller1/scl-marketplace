"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { PasswordField } from "@/components/scl/password-field";
import { Button } from "@/components/ui/button";
import { adminDeleteCapperAction } from "@/lib/actions/account-delete.action";

export function AdminDeleteCapperControl({
  userId,
  capperLabel,
}: {
  userId: string;
  capperLabel: string;
}) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!confirmed) {
      toast.error("Confirm that you understand this action is permanent.");
      return;
    }

    setPending(true);
    try {
      const result = await adminDeleteCapperAction({
        userId,
        adminPassword,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Capper account deleted.");
      router.push("/admin/cappers");
      router.refresh();
    } catch {
      toast.error("We couldn't delete this account. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="border-neg/30 space-y-4 rounded-xl border p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle
          className="text-neg mt-0.5 size-4 shrink-0"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="font-semibold">Delete capper account</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Permanently removes {capperLabel}, their profile, plays, packages,
            and storefront data. This cannot be undone.
          </p>
        </div>
      </div>

      <PasswordField
        id={`admin-delete-password-${userId}`}
        label="Your admin password"
        autoComplete="current-password"
        value={adminPassword}
        onChange={(event) => setAdminPassword(event.target.value)}
      />

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="border-input mt-1 size-4 rounded border"
        />
        <span>
          I understand this permanently deletes this capper account and all
          associated data.
        </span>
      </label>

      <Button
        type="button"
        variant="destructive"
        className="min-h-10 w-full sm:w-auto"
        disabled={pending || !confirmed || adminPassword.length === 0}
        onClick={() => void handleDelete()}
      >
        {pending ? "Deleting…" : "Delete capper account"}
      </Button>
    </div>
  );
}
