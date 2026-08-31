import { Users } from "lucide-react";

import { SectionHeader } from "@/components/scl/section";
import { EmptyState } from "@/components/scl/states";
import { Card } from "@/components/ui/card";
import type { LeaguePickDemand } from "@/lib/odds-demand";
import { formatEasternDateTime } from "@/lib/odds-control-reporting";

export function AdminLeaguePickDemand({
  storageReady,
  windowDays,
  leagues,
}: {
  storageReady: boolean;
  windowDays: number;
  leagues: LeaguePickDemand[];
}) {
  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <SectionHeader
        icon={Users}
        title="League pick demand"
        subtitle={`Unique active cappers and committed picks during the last ${windowDays} days`}
      />
      <p className="text-muted-foreground text-xs leading-5">
        Includes straight picks and parlay legs. Drafts and test accounts are
        excluded. Ranked by active cappers first so broad user demand is not
        hidden by one high-volume capper.
      </p>
      {!storageReady ? (
        <p
          className="border-primary/30 bg-primary/10 rounded-lg border p-3 text-sm"
          role="status"
        >
          League demand is temporarily unavailable. Credit controls remain
          available.
        </p>
      ) : leagues.length ? (
        <div className="border-border overflow-hidden rounded-lg border">
          <div className="bg-surface-2 text-muted-foreground hidden grid-cols-[minmax(12rem,1.5fr)_8rem_8rem_12rem] gap-3 border-b px-4 py-2 text-xs font-medium tracking-wide uppercase md:grid">
            <span>League</span>
            <span>Active cappers</span>
            <span>Pick volume</span>
            <span>Last activity</span>
          </div>
          <div className="divide-border max-h-[32rem] divide-y overflow-y-auto">
            {leagues.map((row) => (
              <article
                key={row.key}
                className="grid gap-3 p-4 md:grid-cols-[minmax(12rem,1.5fr)_8rem_8rem_12rem] md:items-center"
              >
                <div className="min-w-0">
                  <span className="text-muted-foreground mb-1 block text-xs font-medium md:hidden">
                    League
                  </span>
                  <p className="truncate text-sm font-semibold">{row.league}</p>
                  {row.league.toUpperCase() !== row.sport.toUpperCase() ? (
                    <p className="text-muted-foreground text-xs">{row.sport}</p>
                  ) : null}
                </div>
                <div>
                  <span className="text-muted-foreground mb-1 block text-xs font-medium md:hidden">
                    Active cappers
                  </span>
                  <span className="nums text-sm font-semibold">
                    {row.activeCappers.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground mb-1 block text-xs font-medium md:hidden">
                    Pick volume
                  </span>
                  <span className="nums text-sm">
                    {row.picks.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground mb-1 block text-xs font-medium md:hidden">
                    Last activity
                  </span>
                  <span className="text-sm">
                    {formatEasternDateTime(row.lastPickAt)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="No recent league demand"
          description={`No committed picks from active cappers were found in the last ${windowDays} days.`}
          headingLevel="h3"
        />
      )}
    </Card>
  );
}
