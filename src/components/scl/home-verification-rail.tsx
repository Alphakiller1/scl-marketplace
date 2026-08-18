import { ShieldCheck } from "lucide-react";

import { VerificationLegend } from "@/components/scl/verification-legend";
import { cn } from "@/lib/utils";

/**
 * Owner-approved public explanation of SCL's two verification stages.
 */
export function HomeVerificationRail({ className }: { className?: string }) {
  return (
    <aside
      className={cn("space-y-3 sm:space-y-5", className)}
      aria-label="Verification context"
      id="how-verification-works"
    >
      <div className="scl-section-mark">
        <div className="flex items-center gap-2">
          <ShieldCheck
            className="size-4 shrink-0 text-[color:var(--scl-pink)]"
            aria-hidden
          />
          <h2 className="scl-display text-base font-semibold tracking-[0.04em] sm:text-lg">
            Verification
          </h2>
        </div>
        <p className="text-muted-foreground mt-1.5 text-xs leading-snug sm:mt-2 sm:text-sm sm:leading-relaxed">
          SCL uses standardized sportsbook market data to help verify picks and
          results.
        </p>
      </div>

      <VerificationLegend />
    </aside>
  );
}
