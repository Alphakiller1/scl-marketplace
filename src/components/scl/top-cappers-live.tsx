import Link from "next/link";
import { ArrowRight, Trophy, Users } from "lucide-react";

import { RankBoardTable } from "@/components/scl/rank-board-table";
import { EmptyState } from "@/components/scl/states";
import type { CapperSummary } from "@/lib/mock";
import { cn } from "@/lib/utils";

/**
 * Window chips open the full leaderboard for that window.
 * Home Top Cappers itself is verified-share → units (not ROI) — chips must
 * preserve that sort story when exiting to /leaderboard.
 */
const WINDOW_CHIPS = [
  { id: "7d", label: "7D", href: "/leaderboard?window=7d&sort=verified" },
  { id: "30d", label: "30D", href: "/leaderboard?window=30d&sort=verified" },
  { id: "90d", label: "90D", href: "/leaderboard?window=90d&sort=verified" },
  { id: "all", label: "ALL", href: "/leaderboard?window=all&sort=verified" },
] as const;

/**
 * Top Cappers — Rank-schema dense table via shared RankBoardTable.
 * Sort on this surface: verified share → units (see home page.tsx).
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
  activeWindow?: (typeof WINDOW_CHIPS)[number]["id"];
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
            Ranked By Board-Verified Share, Then Units.
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
                  "scl-data inline-flex h-8 min-w-9 items-center justify-center rounded-[var(--scl-radius-chip)] px-2 text-[10px] font-semibold tracking-[0.1em] uppercase transition-colors sm:h-9 sm:min-w-10 sm:px-2.5",
                  active
                    ? "bg-[color:var(--scl-blue)] text-[color:var(--scl-blue-ink)]"
                    : "border-border text-muted-foreground hover:text-foreground border bg-transparent",
                )}
                aria-current={active ? "page" : undefined}
                title={`Open ${chip.label} Leaderboard (Verified Sort)`}
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
            caption="Top Cappers Ranked By Board-Verified Share, Then Units."
          />
          <Link
            href="/leaderboard?sort=verified"
            className="scl-link inline-flex min-h-11 items-center gap-1 text-sm font-medium"
          >
            View Full Leaderboard
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </>
      )}
    </section>
  );
}
