"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { adminUpdateStoreConnectionAction } from "@/lib/actions/store.action";

export function AdminStoreActions({ connectionId }: { connectionId: string }) {
  const [pending, startTransition] = useTransition();

  function run(
    action: "LINKS_RECEIVED" | "NEEDS_ACTION" | "DISABLED" | "LIVE",
  ) {
    startTransition(async () => {
      let adminNotes: string | undefined;
      if (action === "NEEDS_ACTION") {
        const notes = window.prompt("Admin notes for Needs Action:");
        if (notes == null) return;
        adminNotes = notes;
      }
      const res = await adminUpdateStoreConnectionAction({
        connectionId,
        action,
        adminNotes,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Store connection updated");
      window.location.reload();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        className="min-h-10"
        disabled={pending}
        onClick={() => run("LINKS_RECEIVED")}
      >
        Mark links received
      </Button>
      <Button
        size="sm"
        variant="secondary"
        className="min-h-10"
        disabled={pending}
        onClick={() => run("LIVE")}
      >
        Mark store live
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="min-h-10"
        disabled={pending}
        onClick={() => run("NEEDS_ACTION")}
      >
        Needs action
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="min-h-10"
        disabled={pending}
        onClick={() => run("DISABLED")}
      >
        Disable
      </Button>
    </div>
  );
}
