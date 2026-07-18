import { Trophy } from "lucide-react";

import type { CapperSummary } from "@/lib/mock";
import {
  LeaderboardMobileCard,
  LeaderboardRow,
} from "@/components/scl/leaderboard-row";
import { CompactCapperRow } from "@/components/scl/compact-capper-row";
import { EmptyState } from "@/components/scl/states";
import {
  LEADERBOARD_TABLE_COLS,
  LEADERBOARD_TABLE_GAP,
} from "@/components/scl/leaderboard-table";

export function Leaderboard({
  cappers,
  limit,
  failed = false,
  compactMobile = false,
  compactDesktop = false,
  /** Use 1..n list position instead of each capper's global units rank. */
  rankByPosition = false,
  primaryMetric = "units",
  emptyDescription = "No cappers match this ranking scope yet.",
  emptyTitle,
}: {
  cappers: CapperSummary[];
  limit?: number;
  failed?: boolean;
  compactMobile?: boolean;
  compactDesktop?: boolean;
  rankByPosition?: boolean;
  primaryMetric?: "units" | "roi";
  emptyDescription?: string;
  emptyTitle?: string;
}) {
  const visible = typeof limit === "number" ? cappers.slice(0, limit) : cappers;

  if (!visible.length) {
    return (
      <EmptyState
        icon={Trophy}
        title={
          failed
            ? "Couldn't Load The Leaderboard"
            : (emptyTitle ?? "No Ranked Cappers Found")
        }
        description={
          failed
            ? "Performance data is temporarily unavailable. Please try again shortly."
            : emptyDescription
        }
      />
    );
  }

  const place = (capper: CapperSummary, index: number) =>
    rankByPosition ? index + 1 : (capper.rank ?? index + 1);

  return (
    <>
      {compactDesktop ? (
        <div className="space-y-2">
          {visible.map((capper, index) => (
            <CompactCapperRow
              key={capper.id}
              capper={capper}
              rank={place(capper, index)}
              primaryMetric={primaryMetric}
            />
          ))}
        </div>
      ) : (
        <>
          <div className="border-border bg-card hidden overflow-x-auto overflow-y-hidden rounded-xl border md:block">
            <div className="min-w-[52rem]">
              <div
                className={`text-muted-foreground grid ${LEADERBOARD_TABLE_COLS} ${LEADERBOARD_TABLE_GAP} items-end border-b py-2.5 text-[0.7rem] font-semibold uppercase`}
              >
                <span>Rank</span>
                <span>Capper</span>
                <span className="text-right">Win Rate</span>
                <span className="text-right">ROI</span>
                <span className="text-right">Units</span>
                <span className="text-right">Picks</span>
                <span className="text-right">Trend</span>
              </div>
              <div className="divide-border divide-y">
                {visible.map((capper, index) => (
                  <LeaderboardRow
                    key={capper.id}
                    capper={capper}
                    rank={place(capper, index)}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-2 md:hidden">
            {visible.map((capper, index) => (
              <LeaderboardMobileCard
                key={capper.id}
                capper={capper}
                rank={place(capper, index)}
                compact={compactMobile}
                primaryMetric={primaryMetric}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

/** Visually distinct unranked / below-minimum band — never shows competition places. */
export function BuildingRecordSection({
  cappers,
  failed = false,
  minPicks = 0,
}: {
  cappers: CapperSummary[];
  failed?: boolean;
  minPicks?: number;
}) {
  if (!cappers.length || failed) return null;

  return (
    <section
      id="building-a-record"
      aria-label="Building a record"
      className="border-border bg-surface-2/40 mt-8 scroll-mt-20 rounded-xl border border-dashed p-3 sm:mt-10 sm:p-4"
    >
      <div className="mb-3 flex flex-col gap-1 sm:mb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-bold">Building a record</h2>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            {minPicks > 0
              ? `These cappers have fewer than ${minPicks} graded picks in this scope, so no rank is shown yet.`
              : "These cappers are still waiting for a graded pick in this scope, so no rank is shown yet."}{" "}
            A new record is not a poor record.
          </p>
        </div>
        <p className="scl-data text-muted-foreground text-xs tabular-nums">
          {cappers.length.toLocaleString()}{" "}
          {cappers.length === 1 ? "capper" : "cappers"}
        </p>
      </div>
      <Leaderboard
        cappers={cappers}
        compactDesktop
        compactMobile
        emptyTitle="No Cappers Building A Record"
        emptyDescription="Every matching capper currently meets the ranking sample."
      />
    </section>
  );
}
