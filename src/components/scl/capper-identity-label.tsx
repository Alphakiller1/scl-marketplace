import { cn } from "@/lib/utils";
import {
  identityDisplayLinesFromCapper,
  type IdentityDisplayLines,
} from "@/lib/identity";
import { VerificationBadge } from "@/components/scl/badges";

type CapperIdentityFields = {
  name: string;
  handle: string;
  displayName?: string | null;
  verified?: boolean;
};

/**
 * Shared primary / @handle presentation for marketplace identity.
 * Compact surfaces hide near-duplicate secondary lines.
 */
export function CapperIdentityLabel({
  capper,
  compact = false,
  verified,
  primaryClassName,
  secondaryClassName,
  className,
  lines: linesOverride,
}: {
  capper?: CapperIdentityFields;
  compact?: boolean;
  verified?: boolean;
  primaryClassName?: string;
  secondaryClassName?: string;
  className?: string;
  /** Optional precomputed lines (e.g. profile editor preview). */
  lines?: IdentityDisplayLines;
}) {
  const lines =
    linesOverride ??
    (capper
      ? identityDisplayLinesFromCapper(capper, { compact })
      : { primary: "", secondary: null });
  const showVerified = verified ?? capper?.verified;

  return (
    <div className={cn("min-w-0 leading-tight", className)}>
      <div className="flex min-w-0 items-center gap-1">
        <span className={cn("truncate font-semibold", primaryClassName)}>
          {lines.primary}
        </span>
        {showVerified ? <VerificationBadge size="xs" /> : null}
      </div>
      {lines.secondary ? (
        <span
          className={cn(
            "text-muted-foreground block truncate text-xs",
            secondaryClassName,
          )}
        >
          {lines.secondary}
        </span>
      ) : null}
    </div>
  );
}
