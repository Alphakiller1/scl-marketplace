import { LeaderboardSnapshot } from "@/components/scl/leaderboard-snapshot";
import type { CapperSummary } from "@/lib/mock";
import { cn } from "@/lib/utils";

/**
 * Elevated Live-board shell for the hero right rail.
 * Premium gloss = hairline + card shadow + solid ink (no blur / glass).
 */
export function LiveBoardShell({
  boards,
  updatedAt,
  className,
}: {
  boards: {
    id: "1d" | "7d" | "14d";
    label: string;
    cappers: CapperSummary[];
    failed?: boolean;
  }[];
  updatedAt: Date;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "dark relative isolate min-h-[16rem] w-full max-w-xl lg:max-w-none",
        className,
      )}
    >
      <div className="scl-elevated border-border relative min-w-0 overflow-hidden rounded-[var(--scl-radius-card)] border bg-[color:var(--scl-ink-800)]">
        <div className="relative p-2.5 sm:p-4">
          <LeaderboardSnapshot
            boards={boards}
            updatedAt={updatedAt}
            limit={5}
          />
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use LiveBoardShell — collage naming implied overlapping proof. */
export const HeroBoardCollage = LiveBoardShell;
