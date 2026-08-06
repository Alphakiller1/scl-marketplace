"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
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
    </span>
  );
}
