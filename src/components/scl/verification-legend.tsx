import { BadgeCheck, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Shared owner-approved explanation of the two verification stages.
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
          <span className="text-foreground font-medium">Odds Verification</span>
          {" — "}odds synchronized across multiple sportsbooks so bettors can
          shop lines and trust their authenticity
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <BadgeCheck
          className="size-3.5 text-[color:var(--scl-blue)]"
          aria-hidden
        />
        <span>
          <span className="text-foreground font-medium">
            Record Verification
          </span>
          {" — "}pick results automatically graded by Sports Cappers
          Leaderboard, independently from the capper
        </span>
      </span>
    </p>
  );
}
