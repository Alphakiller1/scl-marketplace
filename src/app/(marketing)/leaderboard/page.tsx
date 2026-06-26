import type { Metadata } from "next";
import { Trophy } from "lucide-react";

import { SectionHeader } from "@/components/scl/section";
import {
  LeaderboardRow,
  LeaderboardMobileCard,
} from "@/components/scl/leaderboard-row";
import { MOCK_CAPPERS } from "@/lib/mock";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "Verified sports cappers ranked by units, ROI, and win rate.",
};

export default function LeaderboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <SectionHeader
        icon={Trophy}
        title="Leaderboard"
        subtitle="Verified records, ranked by units won (preview data)"
      />
      <div className="mt-6 hidden md:block">
        <div className="text-muted-foreground grid grid-cols-[2.5rem_1fr_5rem_5rem_5rem_8rem] gap-3 px-3 pb-1 text-[0.7rem] font-medium tracking-wide uppercase">
          <span>#</span>
          <span>Capper</span>
          <span className="text-right">Win %</span>
          <span className="text-right">Units</span>
          <span className="text-right">ROI</span>
          <span className="text-right">Form</span>
        </div>
        <div className="space-y-0.5">
          {MOCK_CAPPERS.map((c) => (
            <LeaderboardRow key={c.id} capper={c} />
          ))}
        </div>
      </div>
      <div className="mt-6 space-y-2 md:hidden">
        {MOCK_CAPPERS.map((c) => (
          <LeaderboardMobileCard key={c.id} capper={c} />
        ))}
      </div>
    </div>
  );
}
