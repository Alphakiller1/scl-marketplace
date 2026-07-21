import { LeaderboardSnapshot } from "@/components/scl/leaderboard-snapshot";
import type { CapperSummary } from "@/lib/mock";
import { cn } from "@/lib/utils";

/**
 * Elevated Live-board shell for the hero right rail.
 * Rank-schema snapshot only — no overlapping proof collage.
 */
export function LiveBoardShell({
  cappers,
  leaderboardFailed,
  updatedAt,
  className,
}: {
  cappers: CapperSummary[];
  leaderboardFailed?: boolean;
  updatedAt: Date;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative isolate min-h-[16rem] w-full max-w-xl lg:max-w-none",
        className,
      )}
    >
      <div className="border-border relative overflow-hidden rounded-[14px] border bg-[color:var(--scl-ink-900)]/92 shadow-[var(--scl-shadow-card)] backdrop-blur-sm">
        <div
          className="scl-scanline pointer-events-none absolute inset-0 opacity-80"
          aria-hidden
        />
        <div className="relative p-3 sm:p-4">
          <LeaderboardSnapshot
            cappers={cappers}
            failed={leaderboardFailed}
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
