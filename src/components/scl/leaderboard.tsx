import { Trophy } from "lucide-react";

import type { CapperSummary } from "@/lib/mock";
import {
  LeaderboardMobileCard,
  LeaderboardRow,
} from "@/components/scl/leaderboard-row";
import { CompactCapperRow } from "@/components/scl/compact-capper-row";
import { EmptyState } from "@/components/scl/states";

const TABLE_COLS =
  "grid-cols-[3.25rem_minmax(13rem,1fr)_5.5rem_5.5rem_5.5rem_4.5rem_8rem]";

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
          <div className="border-border bg-card hidden overflow-hidden rounded-xl border md:block">
            <div
              className={`text-muted-foreground grid ${TABLE_COLS} items-center gap-3 border-b px-3 py-2 text-[0.7rem] font-semibold uppercase`}
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
}: {
  cappers: CapperSummary[];
  failed?: boolean;
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
          <h2 className="text-sm font-bold tracking-wide uppercase">
            Building A Record
          </h2>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            A provisional record is visible but not ranked yet. Zero graded
            picks, below SCL’s minimum graded-pick sample, or net-negative in
            this scope appear here — early history, not a leaderboard signal.
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
