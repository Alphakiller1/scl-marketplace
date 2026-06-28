import Link from "next/link";
import { ClipboardList, MailWarning, Plus } from "lucide-react";

import { getCurrentUser } from "@/lib/session";
import { getCapperPlays } from "@/lib/queries/plays";
import { computeCapperStats } from "@/lib/stats";
import { formatRecord, formatRoi, formatUnits, signTone } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatBlock } from "@/components/scl/stat";
import { EmptyState } from "@/components/scl/states";
import { SectionHeader } from "@/components/scl/section";
import { PlayListItem } from "@/components/scl/play-list-item";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const verified = Boolean(user?.emailVerified);
  const plays = user ? await getCapperPlays(user.id) : [];
  const stats = computeCapperStats(plays);
  const recent = plays.slice(0, 6);

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

      <Card className="p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatBlock
            label="Record"
            value={formatRecord(stats.wins, stats.losses, stats.pushes)}
            sub={`${stats.pending} pending`}
          />
          <StatBlock
            label="Win %"
            value={
              stats.wins + stats.losses > 0
                ? `${stats.winPct.toFixed(1)}%`
                : "—"
            }
          />
          <StatBlock
            label="Units"
            value={stats.settled > 0 ? formatUnits(stats.units) : "0"}
            tone={signTone(stats.units)}
          />
          <StatBlock
            label="ROI"
            value={stats.settled > 0 ? formatRoi(stats.roi) : "—"}
            tone={signTone(stats.roi)}
          />
        </div>
      </Card>

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
