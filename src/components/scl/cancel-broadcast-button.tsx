"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cancelBroadcastAction } from "@/lib/actions/broadcast.action";

/** Two-step cancel for a queued or scheduled campaign. */
export function CancelBroadcastButton({
  broadcastId,
  subject,
}: {
  broadcastId: string;
  subject: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setConfirming(true)}
        aria-label={`Cancel campaign ${subject}`}
      >
        Cancel
      </Button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2" role="group">
      <span className="text-xs">Stop unsent emails?</span>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await cancelBroadcastAction(broadcastId);
            if (result.ok) toast.success("Campaign cancelled.");
            else toast.error(result.error);
            setConfirming(false);
          })
        }
      >
        Yes, cancel
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => setConfirming(false)}
      >
        Keep
      </Button>
    </span>
  );
}
