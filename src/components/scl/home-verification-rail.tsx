import { ShieldCheck } from "lucide-react";

import { VerificationLegend } from "@/components/scl/verification-legend";
import { cn } from "@/lib/utils";

/**
 * Homepage evidence field — verification / receipt context rail (4-col).
 * Pink verification mark stays dominant; clarifies authenticity ≠ result.
 */
export function HomeVerificationRail({ className }: { className?: string }) {
  return (
    <aside
      className={cn("space-y-5", className)}
      aria-label="Verification context"
      id="how-verification-works"
    >
      <div className="scl-section-mark">
        <div className="flex items-center gap-2">
          <ShieldCheck
            className="size-4 shrink-0 text-[color:var(--scl-pink)]"
            aria-hidden
          />
          <h2 className="scl-display text-lg font-semibold tracking-[0.04em]">
            Verification
          </h2>
        </div>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Account checks and pick authenticity are separate. Board-verified
          means odds were captured pre-game and checked against the live market
          — not that the pick won.
        </p>
      </div>

      <VerificationLegend />

      <p className="text-muted-foreground text-sm leading-relaxed">
        The pink stamp is the trust mark. Settlement (win / loss / push) is a
        separate result signal and never replaces verification.
      </p>
    </aside>
  );
}
