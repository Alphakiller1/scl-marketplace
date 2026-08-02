import type { StoreConnectionStatus } from "@prisma/client";

import { storeStatusLabel, storeStatusTone } from "@/lib/store-connection";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<ReturnType<typeof storeStatusTone>, string> = {
  neutral: "border-border bg-surface-2 text-muted-foreground",
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  info: "border-live/40 bg-live/10 text-foreground",
  live: "border-pos/40 bg-pos/10 text-pos",
  danger: "border-neg/40 bg-neg/10 text-neg",
  disabled: "border-border bg-surface-2 text-muted-foreground opacity-80",
};

export function StoreStatusChip({
  status,
  label,
  className,
}: {
  status: StoreConnectionStatus;
  label?: string;
  className?: string;
}) {
  const tone = storeStatusTone(status);
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-[0.65rem] leading-none font-semibold tracking-wide uppercase",
        TONE_CLASS[tone],
        className,
      )}
    >
      <span
        className="size-1.5 rounded-full bg-current opacity-80"
        aria-hidden
      />
      {label || storeStatusLabel(status)}
    </span>
  );
}
