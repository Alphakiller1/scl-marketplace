import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileText,
  Gavel,
  Mail,
  Gauge,
  Send,
  Store,
  Users,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { AdminOperationsOverview } from "@/components/scl/admin-operations-overview";
import { AdminReleaseReadiness } from "@/components/scl/admin-release-readiness";
import { SectionHeader } from "@/components/scl/section";
import { getAdminOperationalOverview } from "@/lib/queries/admin-operations";
import { getReleaseReadinessReport } from "@/lib/queries/release-readiness";

export const metadata = { title: "Admin" };

const ADMIN_TOOLS = [
  {
    href: "/admin/odds",
    title: "API credits",
    description:
      "Monitor Odds API spend and manage sports, market coverage, cadence, and credit guardrails.",
    icon: Gauge,
  },
  {
    href: "/admin/plays",
    title: "Published plays",
    description:
      "Inspect the public ledger, review settlement history, and safely correct graded straight plays or parlays.",
    icon: ClipboardList,
  },
  {
    href: "/admin/grading",
    title: "Grading operations",
    description:
      "Review pending plays, run automatic grading, correct results, and inspect the audit trail.",
    icon: ClipboardCheck,
  },
  {
    href: "/admin/cappers",
    title: "Capper management",
    description:
      "Review capper accounts and change account status when access needs intervention.",
    icon: Users,
  },
  {
    href: "/admin/store-setup",
    title: "Storefronts & packages",
    description:
      "Track Winible and Whop onboarding, review packages, manage links, and monitor clicks.",
    icon: Store,
  },
  {
    href: "/admin/emails",
    title: "Automated email copy",
    description:
      "Edit the wording of the welcome, verification, reset, and claim emails. Links stay under SCL's control.",
    icon: Mail,
  },
  {
    href: "/admin/messages",
    title: "Campaigns & audiences",
    description:
      "Combine capper activity and storefront filters, save groups, review recipients, and schedule tracked Brevo campaigns.",
    icon: Send,
  },
  {
    href: "/admin/policies",
    title: "Policy documents",
    description:
      "Publish Terms, Privacy, Disclaimer, and Responsible Gaming revisions with an audit history.",
    icon: FileText,
  },
];

const CAPABILITY_STATUS = {
  live: {
    label: "Live",
    icon: CheckCircle2,
    className: "text-[color:var(--scl-perf-win-text)]",
  },
  limited: {
    label: "Limited",
    icon: AlertTriangle,
    className: "text-amber-500",
  },
  planned: {
    label: "Planned",
    icon: Clock3,
    className: "text-muted-foreground",
  },
} as const;

const OWNER_CAPABILITIES = [
  {
    capability: "Published plays and grading corrections",
    status: "live",
    detail:
      "Search every published straight play and parlay, correct misgrades, and retain the audit trail.",
  },
  {
    capability: "Capper and storefront operations",
    status: "live",
    detail:
      "Manage account status, approve or suspend storefronts, edit packages and links, order visibility, affiliate percentage, and internal notes.",
  },
  {
    capability: "Policies and consent",
    status: "live",
    detail:
      "Publish policy revisions and review the versioned acceptance state recorded for each account.",
  },
  {
    capability: "Performance and commerce insight",
    status: "limited",
    detail:
      "Package clicks and affiliate setup are available. Sales and conversion data remain provider-controlled until a verified Whop or Winible integration exists.",
  },
  {
    capability: "Bulk capper email",
    status: "live",
    detail:
      "Build reusable activity and storefront audiences, then send privately through a daily-limit-aware queue with opt-outs and delivery reporting enforced.",
  },
  {
    capability: "Customer accounts and customer email",
    status: "planned",
    detail:
      "Begins when SCL introduces first-party customer accounts and a lawful marketing-consent model.",
  },
] as const;

export default async function AdminOverviewPage() {
  const [operations, releaseReadiness] = await Promise.all([
    getAdminOperationalOverview(),
    getReleaseReadinessReport(),
  ]);

  return (
    <div className="space-y-8">
      <SectionHeader
        icon={Gavel}
        title="Admin Overview"
        subtitle="Operations across the SCL marketplace"
      />
      <AdminOperationsOverview data={operations} />

      <AdminReleaseReadiness
        checks={releaseReadiness.checks}
        summary={releaseReadiness.summary}
      />

      <section className="space-y-4">
        <SectionHeader
          title="Available tools"
          subtitle="These controls are live in the current admin panel"
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ADMIN_TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.href}
                href={tool.href}
                className="focus-visible:ring-ring group rounded-xl outline-none focus-visible:ring-2"
              >
                <Card className="h-full p-4 transition-colors group-hover:bg-[color:var(--scl-surface-2)]">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[color:var(--scl-line)] bg-[color:var(--scl-ink-700)] text-[color:var(--scl-blue)]">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <ArrowRight
                      className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold">{tool.title}</h3>
                    <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                      {tool.description}
                    </p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Owner capability matrix"
          subtitle="What is operational now, what depends on external platforms, and what remains intentionally gated"
        />
        <Card className="overflow-hidden">
          <div className="divide-border divide-y">
            {OWNER_CAPABILITIES.map((item) => {
              const status = CAPABILITY_STATUS[item.status];
              const StatusIcon = status.icon;
              return (
                <div
                  key={item.capability}
                  className="grid gap-2 px-4 py-4 sm:grid-cols-[minmax(12rem,0.85fr)_minmax(0,1.5fr)_auto] sm:items-center"
                >
                  <p className="font-semibold">{item.capability}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {item.detail}
                  </p>
                  <span
                    className={`inline-flex w-fit items-center gap-1.5 text-xs font-semibold ${status.className}`}
                  >
                    <StatusIcon className="size-4" aria-hidden />
                    {status.label}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </section>
    </div>
  );
}
