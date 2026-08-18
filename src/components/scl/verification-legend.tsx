import { BadgeCheck, Scale, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Shared owner-approved explanation of the two verification stages.
 */
export function VerificationLegend({ className }: { className?: string }) {
  return (
    <div
      role="list"
      className={cn(
        "text-muted-foreground grid gap-2 text-xs sm:gap-2.5 sm:text-sm",
        className,
      )}
    >
      <div role="listitem" className="flex items-start gap-2">
        <ShieldCheck
          className="mt-0.5 size-3.5 shrink-0 text-[color:var(--scl-pink)]"
          aria-hidden
        />
        <span>
          <span className="text-foreground font-medium">Odds Verification</span>
          {" — "}SCL captures sportsbook odds and uses that market data as a
          consistent reference when evaluating submitted picks.
        </span>
      </div>
      <div role="listitem" className="flex items-start gap-2">
        <BadgeCheck
          className="mt-0.5 size-3.5 shrink-0 text-[color:var(--scl-blue)]"
          aria-hidden
        />
        <span>
          <span className="text-foreground font-medium">
            Record Verification
          </span>
          {" — "}Pick results are automatically graded by Sports Cappers
          Leaderboard, independently of the capper.
        </span>
      </div>
      <div role="listitem" className="flex items-start gap-2">
        <Scale
          className="mt-0.5 size-3.5 shrink-0 text-[color:var(--scl-blue)]"
          aria-hidden
        />
        <span>
          <span className="text-foreground font-medium">
            Consistent Standards
          </span>
          {" — "}The same underlying odds data and grading methodology are
          applied across cappers, giving bettors a consistent way to compare
          performance.
        </span>
      </div>
    </div>
  );
}
