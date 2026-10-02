import Link from "next/link";
import { Activity, Mail, Store, Users } from "lucide-react";

import { audienceMessagesHref } from "@/lib/admin-audience";
import type { AudienceFilters } from "@/lib/schemas/audience.schema";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/scl/section";
import { StatBlock } from "@/components/scl/stat";

type AudienceMetric = { count: number; filters: AudienceFilters };

function AudienceStat({
  label,
  metric,
  tone,
}: {
  label: string;
  metric: AudienceMetric;
  tone?: "pink" | "default";
}) {
  return (
    <Link
      href={audienceMessagesHref(metric.filters)}
      className="hover:bg-surface-2 focus-visible:ring-ring block min-h-10 rounded-lg p-2 transition-colors outline-none focus-visible:ring-2"
      aria-label={`${label}: ${metric.count}. View audience.`}
    >
      <StatBlock label={label} value={metric.count} tone={tone} />
    </Link>
  );
}

export function AdminOperationsOverview({
  data,
}: {
  data: {
    totals: {
      cappers: number;
      activePlays: number;
      plays7: number;
      plays30: number;
      pendingGrades: number;
    };
    audiences: Record<string, AudienceMetric>;
  };
}) {
  const audience = (key: string) => data.audiences[key]!;

  return (
    <div className="space-y-7">
      <section className="space-y-3">
        <SectionHeader
          icon={Activity}
          title="Current SCL activity"
          subtitle="Operational totals now—not lifetime database volume"
        />
        <Card className="p-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatBlock label="Total cappers" value={data.totals.cappers} />
            <StatBlock
              label="Active plays"
              value={data.totals.activePlays}
              tone="brand"
              sub="Open picks being tracked"
            />
            <StatBlock label="Plays · 7 days" value={data.totals.plays7} />
            <StatBlock label="Plays · 30 days" value={data.totals.plays30} />
            <StatBlock
              label="Started · pending grade"
              value={data.totals.pendingGrades}
              tone="pink"
            />
          </div>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionHeader
          icon={Users}
          title="Capper audiences"
          subtitle="Click any number to review and email the exact matching audience"
        />
        <Card className="p-2">
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5">
            <AudienceStat label="New · 7 days" metric={audience("joined7")} />
            <AudienceStat label="New · 14 days" metric={audience("joined14")} />
            <AudienceStat label="New · 30 days" metric={audience("joined30")} />
            <AudienceStat label="Active accounts" metric={audience("active")} />
            <AudienceStat
              label="Inactive accounts"
              metric={audience("inactive")}
            />
            <AudienceStat label="Verified" metric={audience("verified")} />
            <AudienceStat label="Unverified" metric={audience("unverified")} />
            <AudienceStat label="Has submitted" metric={audience("hasPlays")} />
            <AudienceStat
              label="Never submitted"
              metric={audience("neverSubmitted")}
              tone="pink"
            />
            <AudienceStat label="No plays · 3d" metric={audience("noPlays3")} />
            <AudienceStat label="No plays · 7d" metric={audience("noPlays7")} />
            <AudienceStat
              label="No plays · 14d"
              metric={audience("noPlays14")}
            />
            <AudienceStat
              label="No plays · 30d"
              metric={audience("noPlays30")}
            />
          </div>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionHeader
          icon={Store}
          title="Storefront & monetization"
          subtitle="Find the groups that need setup, review, or outreach"
        />
        <Card className="p-2">
          <div className="grid grid-cols-2 gap-1 lg:grid-cols-4">
            <AudienceStat
              label="Connected storefront"
              metric={audience("connectedStorefront")}
            />
            <AudienceStat
              label="No connected storefront"
              metric={audience("noConnectedStorefront")}
            />
            <AudienceStat
              label="Plays · no storefront"
              metric={audience("playsNoStorefront")}
              tone="pink"
            />
            <AudienceStat
              label="Awaiting SCL review"
              metric={audience("awaitingStorefront")}
              tone="pink"
            />
          </div>
        </Card>
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <Mail className="size-3.5" aria-hidden /> Counts reflect cappers who
          are eligible for announcements; opt-outs and unreachable addresses are
          excluded so dashboard and email totals match.
        </p>
      </section>
    </div>
  );
}
