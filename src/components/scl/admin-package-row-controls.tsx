"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, EyeOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  adminDeletePackageAction,
  adminReorderPackageAction,
  adminSetPackageActiveAction,
} from "@/lib/actions/store.action";

/**
 * Inline reorder + show/hide for one package, so an admin can build a capper's
 * SCL storefront from one screen instead of opening each package to retype a
 * sort number. Publishing the connection stays in the storefront actions panel.
 */
export function AdminPackageRowControls({
  packageId,
  title,
  isActive,
  isFirst,
  isLast,
}: {
  packageId: string;
  title: string;
  isActive: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  /**
   * Set from the server's refusal when the package has attributed picks or
   * recorded clicks. Holding the server's own message means the count shown to
   * the admin is the real one, not a second guess computed in the browser.
   */
  const [historyWarning, setHistoryWarning] = useState<string | null>(null);

  function deletePackage(confirmDestructive: boolean) {
    startTransition(async () => {
      const res = await adminDeletePackageAction({
        packageId,
        confirmDestructive,
      });
      if (!res.ok) {
        // A refusal for history is a prompt to escalate, not a failure.
        if (!confirmDestructive && res.error?.includes("has history")) {
          setHistoryWarning(res.error);
          return;
        }
        toast.error(res.error || "Something went wrong.");
        return;
      }
      setConfirmOpen(false);
      setHistoryWarning(null);
      toast.success(`"${title}" deleted`);
      router.refresh();
    });
  }

  function run(
    work: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) {
    startTransition(async () => {
      const res = await work();
      if (!res.ok) {
        toast.error(res.error || "Something went wrong.");
        return;
      }
      toast.success(success);
      router.refresh();
    });
  }

  return (
    <span className="flex shrink-0 items-center gap-1">
      <Button
        size="icon"
        variant="outline"
        disabled={pending || isFirst}
        aria-label={`Move ${title} up`}
        title="Move up"
        onClick={() =>
          run(
            () => adminReorderPackageAction({ packageId, direction: "UP" }),
            "Package moved up",
          )
        }
      >
        <ArrowUp className="size-3.5" aria-hidden />
      </Button>
      <Button
        size="icon"
        variant="outline"
        disabled={pending || isLast}
        aria-label={`Move ${title} down`}
        title="Move down"
        onClick={() =>
          run(
            () => adminReorderPackageAction({ packageId, direction: "DOWN" }),
            "Package moved down",
          )
        }
      >
        <ArrowDown className="size-3.5" aria-hidden />
      </Button>
      <Button
        size="icon"
        variant="outline"
        disabled={pending}
        aria-label={
          isActive ? `Hide ${title} from profile` : `Show ${title} on profile`
        }
        title={
          isActive
            ? "Deactivate (still needs Mark live to be public)"
            : "Activate (still needs Mark live to be public)"
        }
        onClick={() =>
          run(
            () =>
              adminSetPackageActiveAction({ packageId, isActive: !isActive }),
            isActive
              ? "Package deactivated"
              : "Package activated — Mark live when ready to publish",
          )
        }
      >
        {isActive ? (
          <Eye className="size-3.5" aria-hidden />
        ) : (
          <EyeOff className="size-3.5" aria-hidden />
        )}
      </Button>
      <Button
        size="icon"
        variant="outline"
        disabled={pending}
        aria-label={`Delete ${title}`}
        title="Delete permanently"
        className="text-destructive hover:text-destructive"
        onClick={() => {
          setHistoryWarning(null);
          setConfirmOpen(true);
        }}
      >
        <Trash2 className="size-3.5" aria-hidden />
      </Button>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setHistoryWarning(null);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle className="scl-display text-base font-semibold tracking-[0.02em]">
              Delete “{title}”?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              This removes the offer from SCL permanently. Hiding it keeps the
              record and takes it off the profile just the same.
            </DialogDescription>
          </DialogHeader>

          {historyWarning ? (
            <p className="border-destructive/40 bg-destructive/10 text-foreground rounded-lg border p-3 text-sm leading-relaxed">
              {historyWarning}
            </p>
          ) : null}

          <p className="text-muted-foreground text-xs leading-relaxed">
            The capper’s product on their own Whop storefront is not touched.
          </p>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => deletePackage(Boolean(historyWarning))}
            >
              {historyWarning ? "Delete permanently anyway" : "Delete package"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </span>
  );
}
