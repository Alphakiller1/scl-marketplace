import { BarChart3, ClipboardList, MailWarning } from "lucide-react";

import { getCurrentUser } from "@/lib/session";
import {
  getCapperLegacyRecords,
  getCapperParlays,
  getCapperPlays,
  mergeRecordEntries,
} from "@/lib/queries/plays";
import { computeCapperStats, computeStatsBySport } from "@/lib/stats";
import { buildPerformanceTrend } from "@/lib/leaderboard";
import { NewPickButton } from "@/components/scl/new-pick-button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/scl/states";
import { SectionHeader } from "@/components/scl/section";
import { LegacySportBreakdown } from "@/components/scl/legacy-sport-breakdown";
import { ParlayListItem, PlayListItem } from "@/components/scl/play-list-item";
import { PerformanceBySport } from "@/components/scl/performance-by-sport";
import { PerformanceScoreboard } from "@/components/scl/performance-scoreboard";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const verified = Boolean(user?.emailVerified);
  const [plays, parlays, legacy] = user
    ? await Promise.all([
        getCapperPlays(user.id),
        getCapperParlays(user.id),
        getCapperLegacyRecords(user.id),
      ])
    : [[], [], { baseline: null, bySport: [] }];
  // The carried-over legacy total is part of the capper's record on every
  // public surface, so it is part of it here too. Without it the dashboard
  // reported a different career than the profile it links to.
  const stats = computeCapperStats(plays, legacy.baseline);
  const bySport = computeStatsBySport(plays);
  // Stats stay on straight plays; the recent feed also surfaces parlays as positions.
  const recent = mergeRecordEntries(plays, parlays).slice(0, 6);
  const performanceTrend = buildPerformanceTrend(
    [...plays].reverse().map((play) => ({
      outcome: play.outcome,
      profitUnits: play.profitUnits,
    })),
  );

  return (
    <div className="space-y-7 sm:space-y-8">
      <div>
        <h1 className="scl-display text-2xl font-bold tracking-[0.04em] uppercase">
          Welcome{user?.name ? `, ${user.name}` : ""}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          Your public record updates as board-checked plays grade. Pending
          Tickets are not wins.
        </p>
      </div>

      {!verified ? (
        <Card className="flex items-start gap-3 border-[color:var(--scl-line)] bg-[color:var(--scl-ink-800)] p-4">
          <MailWarning className="mt-0.5 size-5 shrink-0 text-[color:var(--scl-muted-label)]" />
          <div className="text-sm">
            <p className="font-medium">
              Verify Your Email To Start Logging Plays
            </p>
            <p className="text-muted-foreground">
              We sent a verification link when you signed up. Gated capper
              actions unlock once your email is confirmed.
            </p>
          </div>
        </Card>
      ) : null}

      <div className="scl-reveal">
        <PerformanceScoreboard
          record={{
            w: stats.wins,
            l: stats.losses,
            p: stats.pushes,
          }}
          winPct={stats.winPct}
          units={stats.units}
          roi={stats.roi}
          settled={stats.settled}
          pending={stats.pending}
          performanceTrend={performanceTrend}
        />
      </div>

      {bySport.length ? (
        <section
          className="scl-reveal space-y-4"
          style={{ animationDelay: "80ms" }}
        >
          <SectionHeader
            icon={BarChart3}
            title="By Sport"
            subtitle={
              legacy.bySport.length
                ? "Your settled record and return in each sport, from picks logged on SCL"
                : "Your settled record and return in each sport"
            }
          />
          <PerformanceBySport items={bySport} />
        </section>
      ) : null}

      {/*
        The same carried-over breakdown the public profile shows. By Sport above
        counts SCL-logged plays only, so without this the two tables were the
        headline mismatch in miniature: the totals include the legacy record,
        the per-sport rows did not.
      */}
      {legacy.bySport.length ? (
        <section
          className="scl-reveal"
          style={{ animationDelay: "110ms" }}
          aria-label="Legacy record by sport"
        >
          <LegacySportBreakdown records={legacy.bySport} />
        </section>
      ) : null}

      <section
        className="scl-reveal space-y-4"
        style={{ animationDelay: "140ms" }}
      >
        <SectionHeader
          icon={ClipboardList}
          title="Recent Plays"
          href={plays.length ? "/dashboard/picks" : undefined}
        />
        {recent.length ? (
          <div className="space-y-2">
            {recent.map((e) =>
              e.kind === "parlay" ? (
                <ParlayListItem key={`parlay-${e.id}`} parlay={e} />
              ) : (
                <PlayListItem key={e.id} play={e} dashboard />
              ),
            )}
          </div>
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="No Plays Yet"
            description="Submit your first play to start building a verified record."
            action={<NewPickButton variant="outline" />}
          />
        )}
      </section>
    </div>
  );
}
