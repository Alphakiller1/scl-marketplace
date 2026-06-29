import Link from "next/link";
import { ClipboardList, MailWarning, Plus } from "lucide-react";

import { getCurrentUser } from "@/lib/session";
import { getCapperPlays } from "@/lib/queries/plays";
import { computeCapperStats } from "@/lib/stats";
import { buildPerformanceTrend } from "@/lib/leaderboard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/scl/states";
import { SectionHeader } from "@/components/scl/section";
import { PlayListItem } from "@/components/scl/play-list-item";
import { PerformanceScoreboard } from "@/components/scl/performance-scoreboard";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const verified = Boolean(user?.emailVerified);
  const plays = user ? await getCapperPlays(user.id) : [];
  const stats = computeCapperStats(plays);
  const recent = plays.slice(0, 6);
  const performanceTrend = buildPerformanceTrend(
    [...plays].reverse().map((play) => ({
      outcome: play.outcome,
      profitUnits: play.profitUnits,
    })),
  );

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
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
          className="gap-1.5"
        >
          <Plus className="size-4" /> Submit a play
        </Button>
      </div>

      {!verified ? (
        <Card className="border-gold/30 bg-gold/10 flex items-start gap-3 p-4">
          <MailWarning className="text-gold mt-0.5 size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">
              Verify your email to start logging plays
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

      <section className="space-y-4">
        <SectionHeader
          icon={ClipboardList}
          title="Recent plays"
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
            title="No plays yet"
            description="Submit your first play to start building a verified record."
            action={
              <Button
                render={<Link href="/dashboard/picks/new" />}
                nativeButton={false}
              >
                Submit a play
              </Button>
            }
          />
        )}
      </section>
    </div>
  );
}
