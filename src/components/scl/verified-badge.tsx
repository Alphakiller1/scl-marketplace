import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { isVerifiedTier, type VerificationTier } from "@/lib/verification";

/**
 * Single verification vocabulary per SCL-DESIGN-SPEC:
 * "Verified" (gold shield) | "Self-reported" (neutral outline) | "NN% Verified".
 */
export function VerifiedBadge({
  tier,
  verifiedShare,
  className,
}: {
  tier?: VerificationTier | null;
  /** When set, renders "NN% Verified" (never abbreviated). */
  verifiedShare?: number | null;
  className?: string;
}) {
  if (verifiedShare != null && verifiedShare > 0) {
    return (
      <span
        className={cn(
          "scl-data inline-flex items-center gap-1 text-[0.7rem] font-semibold text-[color:var(--scl-pink)]",
          className,
        )}
        title="Share of tracked picks market-verified"
      >
        <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
        {`${Math.round(verifiedShare)}% Verified`}
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
          ? "border border-[color:var(--scl-pink)] text-[color:var(--scl-pink)]"
          : "border border-[color:var(--scl-line)] text-[color:var(--scl-muted-label)]",
        className,
      )}
    >
      {verified ? (
        <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
      ) : null}
      {verified ? "Verified" : "Self-reported"}
    </span>
  );
}
