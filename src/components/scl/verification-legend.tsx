import { BadgeCheck } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Short persistent legend clarifying the two pick trust tiers, so a "Verified" capper whose
 * picks read "Self-reported" doesn't look like a contradiction to a skeptical buyer.
 *
 * Verified = the pick's odds were captured pre-game and checked against the live market.
 * Self-reported = logged by the capper, not market-checked. Authenticity, not the result.
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
        <BadgeCheck
          className="size-3.5 text-[color:var(--scl-pink)]"
          aria-hidden
        />
        <span>
          <span className="text-foreground font-medium">Verified</span> — odds
          captured pre-game &amp; checked against the live market
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="border-border size-3 shrink-0 rounded-full border"
          aria-hidden
        />
        <span>
          <span className="text-foreground font-medium">Self-reported</span> —
          logged by the capper, not market-checked
        </span>
      </span>
    </p>
  );
}
