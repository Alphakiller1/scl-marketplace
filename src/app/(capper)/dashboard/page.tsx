import Link from "next/link";
import { BarChart3, ClipboardList, MailWarning, Plus } from "lucide-react";

import { getCurrentUser } from "@/lib/session";
import { getCapperPlays } from "@/lib/queries/plays";
import { computeCapperStats, computeStatsBySport } from "@/lib/stats";
import { buildPerformanceTrend } from "@/lib/leaderboard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/scl/states";
import { SectionHeader } from "@/components/scl/section";
import { PlayListItem } from "@/components/scl/play-list-item";
import { PerformanceBySport } from "@/components/scl/performance-by-sport";
import { PerformanceScoreboard } from "@/components/scl/performance-scoreboard";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const verified = Boolean(user?.emailVerified);
  const plays = user ? await getCapperPlays(user.id) : [];
  const stats = computeCapperStats(plays);
  const bySport = computeStatsBySport(plays);
  const recent = plays.slice(0, 6);
  const performanceTrend = buildPerformanceTrend(
    [...plays].reverse().map((play) => ({
      outcome: play.outcome,
      profitUnits: play.profitUnits,
    })),
  );

  return (
    <div className="space-y-7 sm:space-y-8">
      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome{user?.name ? `, ${user.name}` : ""}
          </h1>
          <p className="text-muted-foreground text-sm">
            Your record builds as you log plays and they&apos;re graded.
          </p>
        </div>
        <Button
          render={<Link href="/dashboard/picks/new" />}
          nativeButton={false}
          className="min-h-11 w-full gap-1.5 sm:min-h-8 sm:w-auto"
        >
          <Plus className="size-4" /> Submit A Play
        </Button>
      </div>

      {!verified ? (
        <Card className="border-gold/30 bg-gold/10 flex items-start gap-3 p-4">
          <MailWarning className="text-gold mt-0.5 size-5 shrink-0" />
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

      {bySport.length ? (
        <section className="space-y-4">
          <SectionHeader
            icon={BarChart3}
            title="By Sport"
            subtitle="Your settled record and return in each sport"
          />
          <PerformanceBySport items={bySport} />
        </section>
      ) : null}

      <section className="space-y-4">
        <SectionHeader
          icon={ClipboardList}
          title="Recent Plays"
          href={plays.length ? "/dashboard/picks" : undefined}
        />
        {recent.length ? (
          <div className="space-y-2">
            {recent.map((p) => (
              <PlayListItem key={p.id} play={p} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="No Plays Yet"
            description="Submit your first play to start building a verified record."
            action={
              <Button
                render={<Link href="/dashboard/picks/new" />}
                nativeButton={false}
              >
                Submit A Play
              </Button>
            }
          />
        )}
      </section>
    </div>
  );
}
