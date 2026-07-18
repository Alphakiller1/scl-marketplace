import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Short persistent legend clarifying pick trust tiers (authenticity, not result).
 * GPT Step 1 locked copy.
 */
export function VerificationLegend({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <ShieldCheck
          className="size-3.5 text-[color:var(--scl-pink)]"
          aria-hidden
        />
        <span>
          <span className="text-foreground font-medium">Verified</span> — odds
          captured on the board before tip and checked against the market.
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="border-border size-3 shrink-0 rounded-full border"
          aria-hidden
        />
        <span>
          <span className="text-foreground font-medium">Logged</span> —
          historical entry not board-checked; does not count toward verified
          rank.
        </span>
      </span>
    </p>
  );
}
