import Link from "next/link";
import { Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Launch-safe profile action: only surface the storefront flow that persists. */
export function ProfileActionGroup({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      role="group"
      aria-label="Profile actions"
    >
      <Button
        render={<Link href="#storefront" />}
        nativeButton={false}
        variant="outline"
        size="sm"
        className="min-h-10 gap-1.5"
      >
        <Store className="size-3.5" aria-hidden />
        View offers
      </Button>
    </div>
  );
}
