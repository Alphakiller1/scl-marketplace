"use client";

import { useState } from "react";
import type { AccountStatus } from "@prisma/client";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateAccountStatusAction } from "@/lib/actions/account-status.action";

const statusOptions: { value: AccountStatus; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "DISABLED", label: "Disabled" },
];

export function AccountStatusControl({
  userId,
  currentStatus,
}: {
  userId: string;
  currentStatus: AccountStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const changed = status !== currentStatus;

  async function save() {
    setPending(true);
    const result = await updateAccountStatusAction({
      userId,
      status,
      reason,
    });
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Account status updated");
    setReason("");
    router.refresh();
  }

  return (
    <div className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_2.5rem]">
      <select
        aria-label="Account status"
        value={status}
        onChange={(event) => setStatus(event.target.value as AccountStatus)}
        className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 min-h-10 rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3"
      >
        {statusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={200}
        placeholder="Reason for change"
        aria-label="Status change reason"
        className="min-h-10"
      />
      <Button
        type="button"
        size="icon"
        className="size-10 justify-self-end"
        aria-label="Apply account status"
        title="Apply account status"
        disabled={!changed || pending}
        onClick={() => void save()}
      >
        <Save className="size-4" />
      </Button>
    </div>
  );
}
