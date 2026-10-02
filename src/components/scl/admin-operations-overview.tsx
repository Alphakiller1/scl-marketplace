import Link from "next/link";
import { Activity, Mail, Store, Users } from "lucide-react";

import { audienceListHref } from "@/lib/admin-audience";
import type {
  AdminOperationalOverview,
  AudienceMetric,
} from "@/lib/queries/admin-operations";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/scl/section";
import { StatBlock } from "@/components/scl/stat";

const tileClass =
  "hover:bg-surface-2 focus-visible:ring-ring block min-h-10 rounded-lg p-2 transition-colors outline-none focus-visible:ring-2";

function LinkedStat({
  href,
  label,
  value,
  sub,
  tone,
  description,
}: {
  href: string;
  label: string;
  value: number;
  sub?: string;
  tone?: "pink" | "brand" | "default";
  description: string;
}) {
  return (
    <Link href={href} className={tileClass} aria-label={description}>
      <StatBlock label={label} value={value} tone={tone} sub={sub} />
    </Link>
  );
}

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
    <LinkedStat
      href={audienceListHref(metric.filters)}
      label={label}
      value={metric.count}
      tone={tone}
      sub={`${metric.emailable} emailable`}
      description={`${label}: ${metric.count} cappers, ${metric.emailable} emailable. Open the list.`}
    />
  );
}

export function AdminOperationsOverview({
  data,
}: {
  data: AdminOperationalOverview;
}) {
  const { totals, audiences } = data;

  return (
    <div className="space-y-7">
      <section className="space-y-3">
        <SectionHeader
          icon={Activity}
          title="Current SCL activity"
          subtitle="What is open right now — not lifetime database volume"
        />
        <Card className="p-2">
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5">
            <LinkedStat
              href="/admin/plays?status=pending"
              label="Active plays"
              value={totals.activePlays}
              tone="brand"
              sub="Unresolved, upcoming or underway"
              description={`Active plays: ${totals.activePlays}. Open the pending plays register.`}
            />
            <LinkedStat
              href="/admin/grading"
              label="Pending grades"
              value={totals.pendingGrades}
              tone="pink"
              sub="Started and awaiting a grade"
              description={`Pending grades: ${totals.pendingGrades}. Open the grading queue.`}
            />
            <AudienceStat label="Played · 7 days" metric={audiences.played7} />
            <AudienceStat
              label="Played · 30 days"
              metric={audiences.played30}
            />
            <div className="p-2">
              <StatBlock
                label="Plays submitted"
                value={totals.plays7}
                sub={`7 days · ${totals.plays30} in 30 days`}
              />
            </div>
          </div>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionHeader
          icon={Users}
          title="Capper activity"
          subtitle="Open any number to see the exact cappers behind it"
        />
        <Card className="p-2">
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5">
            <AudienceStat label="Total cappers" metric={audiences.all} />
            <AudienceStat label="New · 7 days" metric={audiences.joined7} />
            <AudienceStat label="New · 14 days" metric={audiences.joined14} />
            <AudienceStat label="New · 30 days" metric={audiences.joined30} />
            <AudienceStat label="Active accounts" metric={audiences.active} />
            <AudienceStat
              label="Inactive accounts"
              metric={audiences.inactive}
            />
            <AudienceStat label="Verified" metric={audiences.verified} />
            <AudienceStat label="Unverified" metric={audiences.unverified} />
            <AudienceStat label="Has submitted" metric={audiences.hasPlays} />
            <AudienceStat
              label="Never submitted"
              metric={audiences.neverSubmitted}
              tone="pink"
            />
            <AudienceStat label="No plays · 3d" metric={audiences.noPlays3} />
            <AudienceStat label="No plays · 7d" metric={audiences.noPlays7} />
            <AudienceStat label="No plays · 14d" metric={audiences.noPlays14} />
            <AudienceStat label="No plays · 30d" metric={audiences.noPlays30} />
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
              metric={audiences.connectedStorefront}
            />
            <AudienceStat
              label="No connected storefront"
              metric={audiences.noConnectedStorefront}
            />
            <AudienceStat
              label="Plays · no storefront"
              metric={audiences.playsNoStorefront}
              tone="pink"
            />
            <AudienceStat
              label="Awaiting SCL review"
              metric={audiences.awaitingStorefront}
              tone="pink"
            />
          </div>
          <p className="text-muted-foreground px-2 pt-1 pb-2 text-xs">
            {totals.storefrontQueue} storefront connection
            {totals.storefrontQueue === 1 ? "" : "s"} in the review queue ·{" "}
            <Link
              href="/admin/store-setup?requiresAttention=true"
              className="hover:text-foreground underline underline-offset-2"
            >
              Open review queue
            </Link>
          </p>
        </Card>
        <p className="text-muted-foreground flex items-start gap-2 text-xs">
          <Mail className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Each number
          is the full group. &ldquo;Emailable&rdquo; excludes opt-outs,
          suspended accounts, placeholder or bounced addresses, and duplicate
          inboxes — it is exactly the recipient count a campaign to that group
          shows. Test and demo accounts are never counted.
        </p>
      </section>
    </div>
  );
}
