import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The single New Pick call-to-action. One consistent look wherever a capper
 * starts a pick — avoids the mismatched "NEW PICK" / "+ New Pick" / "New Pick"
 * variants that read as redundant.
 */
export function NewPickButton({
  className,
  variant = "brand",
}: {
  className?: string;
  variant?: "brand" | "outline";
}) {
  return (
    <Button
      render={<Link href="/dashboard/picks/new" />}
      nativeButton={false}
      variant={variant}
      className={cn("gap-1.5 font-semibold tracking-[0.01em]", className)}
    >
      <Plus className="size-4" aria-hidden />
      New Pick
    </Button>
  );
}
