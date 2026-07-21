import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { isVerifiedTier, type VerificationTier } from "@/lib/verification";

/**
 * Verification badge per SCL deliverables Step 3:
 * 100% share → pink badge only; <100% → muted outline, no percent text on leaderboard.
 */
export function VerifiedBadge({
  tier,
  verifiedShare,
  showPercent = false,
  className,
}: {
  tier?: VerificationTier | null;
  /** When set, drives share-based treatment (leaderboard/profile). */
  verifiedShare?: number | null;
  /** Show percent text (profile meta only — default false for leaderboard). */
  showPercent?: boolean;
  className?: string;
}) {
  if (verifiedShare != null && verifiedShare >= 99.5) {
    return (
      <span
        className={cn(
          "inline-flex min-h-8 items-center rounded-md border border-[color:var(--scl-pink)] px-2 text-[color:var(--scl-text)]",
          className,
        )}
        aria-label="Fully board-verified record"
        title="All picks on this record were board-verified."
      >
        <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
      </span>
    );
  }

  if (verifiedShare != null && verifiedShare > 0) {
    const pct = Math.round(verifiedShare);
    if (showPercent) {
      return (
        <span
          className={cn(
            "scl-data text-muted-foreground inline-flex items-center gap-1 text-[0.7rem] font-semibold",
            className,
          )}
          aria-label={`${pct} percent of picks board-verified`}
          title={`${pct}% of this capper's picks were board-verified. Only verified picks count toward rank.`}
        >
          <ShieldCheck
            className="size-3.5 shrink-0 text-[color:var(--scl-pink)]"
            aria-hidden
          />
          {`${pct}% board-verified`}
        </span>
      );
    }
    return (
      <span
        className={cn(
          "inline-flex min-h-8 items-center rounded-md border border-[color:var(--scl-line)] px-2 text-[color:var(--scl-muted-label)]",
          className,
        )}
        aria-label={`${pct} percent of picks board-verified`}
        title={`${pct}% of this capper's picks were board-verified. Only verified picks count toward rank.`}
      >
        <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
      </span>
    );
  }

  if (!tier) return null;

  const verified = isVerifiedTier(tier);
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-[0.7rem] font-semibold tracking-wide",
        verified
          ? "border border-[color:var(--scl-pink)] text-[color:var(--scl-text)]"
          : "text-muted-foreground border border-[color:var(--scl-line)]",
        className,
      )}
      aria-label={verified ? "Board-Verified Pick" : "Logged pick"}
    >
      {verified ? (
        <ShieldCheck
          className="size-3.5 shrink-0 text-[color:var(--scl-pink)]"
          aria-hidden
        />
      ) : null}
      {verified ? "Verified" : "Logged"}
    </span>
  );
}
