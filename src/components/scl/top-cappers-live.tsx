"use client";

import Link from "next/link";
import { ArrowRight, LoaderCircle, Trophy, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { RankBoardTable } from "@/components/scl/rank-board-table";
import { EmptyState } from "@/components/scl/states";
import { sortLeaderboard, type LeaderboardSort } from "@/lib/leaderboard";
import type { CapperSummary } from "@/lib/mock";
import { cn } from "@/lib/utils";

const WINDOW_CHIPS = [
  { id: "1d", label: "1D" },
  { id: "7d", label: "7D" },
  { id: "14d", label: "14D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "all", label: "All Time" },
] as const;

const METRIC_CHIPS: { id: LeaderboardSort; label: string }[] = [
  { id: "roi", label: "ROI" },
  { id: "winPct", label: "Win%" },
  { id: "units", label: "Units" },
];

type WindowId = (typeof WINDOW_CHIPS)[number]["id"];
type Board = { failed: boolean; cappers: CapperSummary[] };

/** Interactive home leaderboard. Time filters lazy-load and update in place. */
export function TopCappersLive({
  initialWindow = "90d",
  initialBoard,
  className,
}: {
  initialWindow?: WindowId;
  initialBoard: Board;
  className?: string;
}) {
  const [window, setWindow] = useState<WindowId>(initialWindow);
  const [metric, setMetric] = useState<LeaderboardSort>("roi");
  const [boards, setBoards] = useState<Partial<Record<WindowId, Board>>>({
    [initialWindow]: initialBoard,
  });
  const [loadingWindow, setLoadingWindow] = useState<WindowId | null>(null);
  const board = boards[window] ?? { failed: false, cappers: [] };
  const cappers = useMemo(
    () => sortLeaderboard(board.cappers, metric).slice(0, 10),
    [board.cappers, metric],
  );

  async function selectWindow(nextWindow: WindowId) {
    setWindow(nextWindow);
    if (boards[nextWindow]) return;
    setLoadingWindow(nextWindow);
    try {
      const response = await fetch(
        `/api/leaderboard/home?window=${nextWindow}`,
      );
      if (!response.ok) throw new Error("Leaderboard request failed");
      const nextBoard = (await response.json()) as Board;
      setBoards((current) => ({ ...current, [nextWindow]: nextBoard }));
    } catch {
      setBoards((current) => ({
        ...current,
        [nextWindow]: { failed: true, cappers: [] },
      }));
    } finally {
      setLoadingWindow((current) => (current === nextWindow ? null : current));
    }
  }

  const isLoading = loadingWindow === window && !boards[window];

  return (
    <section className={cn("space-y-3", className)} aria-label="Top Cappers">
      <div className="space-y-3">
        <div className="scl-section-mark flex items-center gap-2">
          <Trophy className="size-4 text-[color:var(--scl-pink)]" aria-hidden />
          <h2 className="scl-display text-[1.25rem] leading-7 font-semibold tracking-[0.02em] normal-case sm:text-[1.375rem]">
            Top Cappers
          </h2>
        </div>
        <p className="text-muted-foreground text-xs leading-snug sm:text-sm">
          {WINDOW_CHIPS.find((chip) => chip.id === window)?.label} - Ranked By{" "}
          {METRIC_CHIPS.find((chip) => chip.id === metric)?.label}
        </p>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Leaderboard time window"
        >
          {WINDOW_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => void selectWindow(chip.id)}
              className={cn(
                "scl-data inline-flex min-h-10 min-w-10 items-center justify-center rounded-[var(--scl-radius-chip)] px-2 text-[0.68rem] font-semibold tracking-[0.08em] uppercase transition-colors",
                chip.id === window
                  ? "bg-[color:var(--scl-blue)] text-[color:var(--scl-blue-ink)]"
                  : "border-border text-muted-foreground hover:text-foreground border bg-transparent",
              )}
              aria-pressed={chip.id === window}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Leaderboard ranking metric"
        >
          {METRIC_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setMetric(chip.id)}
              className={cn(
                "inline-flex min-h-10 items-center rounded-[var(--scl-radius-chip)] px-3 text-xs font-semibold transition-colors",
                chip.id === metric
                  ? "bg-[color:var(--scl-pink)] text-white"
                  : "border-border text-muted-foreground hover:text-foreground border bg-transparent",
              )}
              aria-pressed={chip.id === metric}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div
          className="text-muted-foreground flex min-h-32 items-center justify-center gap-2 text-sm"
          role="status"
        >
          <LoaderCircle className="size-4 animate-spin" aria-hidden /> Loading{" "}
          {window.toUpperCase()} rankings
        </div>
      ) : !cappers.length ? (
        <EmptyState
          icon={Users}
          title={
            board.failed
              ? "Couldn't Load Top Cappers"
              : "No Cappers Qualify Yet"
          }
          description="No Capper Has Reached The Minimum Graded Sample For This List."
        />
      ) : (
        <>
          <RankBoardTable
            cappers={cappers}
            density="live"
            caption={`Top Cappers: ${window}, ranked by ${metric}.`}
          />
          <Link
            href={`/leaderboard?window=${window}&sort=${metric}`}
            className="scl-link inline-flex min-h-10 items-center gap-1 text-sm font-medium"
          >
            View Full Leaderboard{" "}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </>
      )}
    </section>
  );
}
