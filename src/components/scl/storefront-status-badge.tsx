import type { StorefrontStatus } from "@prisma/client";

import { STOREFRONT_STATUS_LABEL, storefrontStatusTone } from "@/lib/commerce";
import { cn } from "@/lib/utils";

const toneClass = {
  muted: "bg-surface-2 text-muted-foreground",
  pos: "bg-emerald-500/15 text-emerald-300",
  neg: "bg-red-500/15 text-red-300",
  brand: "bg-brand/15 text-brand",
} as const;

export function StorefrontStatusBadge({
  status,
  className,
}: {
  status: StorefrontStatus;
  className?: string;
}) {
  const tone = storefrontStatusTone(status);
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-md px-2 text-[0.7rem] font-semibold tracking-wide uppercase",
        toneClass[tone],
        className,
      )}
    >
      {STOREFRONT_STATUS_LABEL[status]}
    </span>
  );
}
