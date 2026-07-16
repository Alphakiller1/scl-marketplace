import { BadgeCheck } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Persistent legend for pick authenticity tiers (Verified ≠ Won).
 * "Logged" is the public string for non-board-verified picks.
 */
export function VerificationLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "border-border bg-card text-muted-foreground flex flex-col gap-2 rounded-[var(--scl-radius-chip)] border px-3 py-2.5 text-xs leading-snug sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-1.5",
        className,
      )}
      role="note"
    >
      <span className="inline-flex min-h-10 items-center gap-2 sm:min-h-0">
        <BadgeCheck
          className="size-3.5 shrink-0 text-[color:var(--scl-pink)]"
          aria-hidden
        />
        <span>
          <span className="text-foreground font-medium">Board-verified</span>
          {" — "}
          odds captured before tip/pitch and checked against the live board
        </span>
      </span>
      <span className="inline-flex min-h-10 items-center gap-2 sm:min-h-0">
        <span
          className="border-border size-3 shrink-0 rounded-full border"
          aria-hidden
        />
        <span>
          <span className="text-foreground font-medium">Logged</span>
          {" — "}
          posted by the capper; not board-checked (authenticity, not the result)
        </span>
      </span>
    </div>
  );
}
