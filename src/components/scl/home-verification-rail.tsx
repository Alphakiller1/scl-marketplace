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
      className={cn("space-y-4", className)}
      aria-label="Verification context"
      id="how-verification-works"
    >
      <div className="border-t border-[color:var(--scl-pink-deep)] pt-2.5">
        <div className="flex items-center gap-2">
          <ShieldCheck
            className="size-4 shrink-0 text-[color:var(--scl-pink)]"
            aria-hidden
          />
          <h2 className="scl-display text-[1.375rem] leading-7 font-semibold tracking-[0.02em] normal-case">
            Verification
          </h2>
        </div>
        <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
          Account Checks And Pick Authenticity Are Separate. Board-Verified
          Means Odds Were Captured Pre-Game And Checked Against The Live Market
          — Not That The Pick Won.
        </p>
      </div>

      <VerificationLegend />

      <p className="text-muted-foreground text-xs leading-relaxed">
        The Pink Stamp Is The Trust Mark. Settlement (Win / Loss / Push) Is A
        Separate Result Signal And Never Replaces Verification.
      </p>
    </aside>
  );
}
