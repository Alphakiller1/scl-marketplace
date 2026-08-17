import Link from "next/link";
import { ArrowRight, Trophy, Users } from "lucide-react";

import { RankBoardTable } from "@/components/scl/rank-board-table";
import { EmptyState } from "@/components/scl/states";
import {
  LEADERBOARD_SCOPE_WINDOWS,
  type LeaderboardWindow,
} from "@/lib/leaderboard";
import type { CapperSummary } from "@/lib/mock";
import { cn } from "@/lib/utils";

/**
 * Window chips open the full leaderboard for that window.
 * Home Top Cappers itself is net units (not ROI) — chips must
 * preserve that sort story when exiting to /leaderboard.
 */
const WINDOW_CHIPS = LEADERBOARD_SCOPE_WINDOWS.map((window) => ({
  id: window.key,
  label: window.key === "all" ? "ALL" : window.label,
  longLabel: window.longLabel,
  href: `/leaderboard?window=${window.key}&sort=units`,
}));

/**
 * Top Cappers — Rank-schema dense table via shared RankBoardTable.
 * Sort on this surface: net units (see home page.tsx).
 */
export function TopCappersLive({
  cappers,
  failed = false,
  /** Must match the home query window (default all-time). Chips are exit links. */
  activeWindow = "all",
  className,
}: {
  cappers: CapperSummary[];
  failed?: boolean;
  activeWindow?: Exclude<LeaderboardWindow, "year">;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)} aria-label="Top Cappers">
      <div className="flex flex-wrap items-end justify-between gap-2.5 sm:gap-4">
        <div className="min-w-0">
          <div className="scl-section-mark flex items-center gap-2">
            <Trophy
              className="size-4 text-[color:var(--scl-pink)]"
              aria-hidden
            />
            <h2 className="scl-display text-[1.25rem] leading-7 font-semibold tracking-[0.02em] normal-case sm:text-[1.375rem]">
              Top Cappers
            </h2>
          </div>
          <p className="text-muted-foreground mt-1 text-xs leading-snug sm:mt-1.5 sm:text-sm sm:leading-relaxed">
            Ranked By Net Units.
          </p>
        </div>
        <div
          className="flex flex-wrap items-center gap-1.5 sm:gap-2"
          role="group"
          aria-label="Open Full Leaderboard By Window"
        >
          {WINDOW_CHIPS.map((chip) => {
            const active = chip.id === activeWindow;
            return (
              <Link
                key={chip.id}
                href={chip.href}
                className={cn(
                  "scl-data inline-flex min-h-10 min-w-10 items-center justify-center rounded-[var(--scl-radius-chip)] px-2 text-[0.68rem] leading-none font-semibold tracking-[0.08em] uppercase transition-colors",
                  active
                    ? "bg-[color:var(--scl-blue)] text-[color:var(--scl-blue-ink)]"
                    : "border-border text-muted-foreground hover:text-foreground border bg-transparent",
                )}
                aria-current={active ? "page" : undefined}
                title={`Open ${chip.longLabel} Leaderboard (Net Units Sort)`}
              >
                {chip.label}
              </Link>
            );
          })}
        </div>
      </div>

      {!cappers.length ? (
        <EmptyState
          icon={Users}
          title={
            failed ? "Couldn't Load Top Cappers" : "No Cappers Qualify Yet"
          }
          description="No Capper Has Reached The Minimum Graded Sample For This List."
        />
      ) : (
        <>
          <RankBoardTable
            cappers={cappers}
            density="live"
            caption="Top Cappers Ranked By Net Units."
          />
          <Link
            href="/leaderboard?sort=units"
            className="scl-link inline-flex min-h-10 items-center gap-1 text-sm font-medium"
          >
            View Full Leaderboard
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </>
      )}
    </section>
  );
}
