import type { StoreProvider } from "@prisma/client";

import { providerLabel } from "@/lib/store-connection";
import { cn } from "@/lib/utils";

export function ProviderBadge({
  provider,
  className,
}: {
  provider: StoreProvider;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full border px-2 text-[0.65rem] leading-none font-bold tracking-[0.08em] uppercase",
        provider === "WINIBLE"
          ? "border-live/35 bg-live/10 text-foreground"
          : "border-brand/35 bg-brand/10 text-foreground",
        className,
      )}
    >
      {providerLabel(provider)}
    </span>
  );
}
