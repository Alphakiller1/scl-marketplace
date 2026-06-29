import { Trophy } from "lucide-react";

import type { CapperSummary } from "@/lib/mock";
import {
  LeaderboardMobileCard,
  LeaderboardRow,
} from "@/components/scl/leaderboard-row";
import { EmptyState } from "@/components/scl/states";

export function Leaderboard({
  cappers,
  limit,
  failed = false,
  emptyDescription = "No cappers match this ranking scope yet.",
}: {
  cappers: CapperSummary[];
  limit?: number;
  failed?: boolean;
  emptyDescription?: string;
}) {
  const visible = typeof limit === "number" ? cappers.slice(0, limit) : cappers;

  if (!visible.length) {
    return (
      <EmptyState
        icon={Trophy}
        title={
          failed ? "Couldn't load the leaderboard" : "No ranked cappers found"
        }
        description={
          failed
            ? "Performance data is temporarily unavailable. Please try again shortly."
            : emptyDescription
        }
      />
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <div className="text-muted-foreground grid grid-cols-[3.25rem_minmax(13rem,1fr)_5.5rem_5.5rem_5.5rem_4.5rem_8rem] items-center gap-3 border-b px-3 py-2 text-[0.7rem] font-semibold uppercase">
          <span>Rank</span>
          <span>Capper</span>
          <span className="text-right">Win rate</span>
          <span className="text-right">ROI</span>
          <span className="text-right">Units</span>
          <span className="text-right">Picks</span>
          <span className="text-right">Trend</span>
        </div>
        <div className="divide-border divide-y">
          {visible.map((capper) => (
            <LeaderboardRow
              key={capper.id}
              capper={capper}
              rank={capper.rank}
            />
          ))}
        </div>
      </div>
      <div className="space-y-2 md:hidden">
        {visible.map((capper) => (
          <LeaderboardMobileCard
            key={capper.id}
            capper={capper}
            rank={capper.rank}
          />
        ))}
      </div>
    </>
  );
}
