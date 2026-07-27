import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  ClipboardList,
  FileClock,
  FileText,
  Gavel,
  MousePointerClick,
  PackageCheck,
  Store,
  TestTube2,
  UserRoundCog,
  Users,
} from "lucide-react";

import { SectionHeader } from "@/components/scl/section";
import { StatBlock } from "@/components/scl/stat";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAdminOperationsOverview } from "@/lib/queries/admin-overview";
import { cn } from "@/lib/utils";

export const metadata = { title: "Admin" };

type QueueCardProps = {
  href: string;
  title: string;
  description: string;
  count: number;
  countLabel: string;
  urgent?: boolean;
  icon: typeof AlertTriangle;
};

function QueueCard({
  href,
  title,
  description,
  count,
  countLabel,
  urgent,
  icon: Icon,
}: QueueCardProps) {
  return (
    <Card className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg border",
            urgent
              ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
              : "border-[color:var(--scl-line)] bg-[color:var(--scl-ink-700)] text-[color:var(--scl-blue)]",
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <Badge variant={count > 0 ? "default" : "secondary"}>
          {count} {countLabel}
        </Badge>
      </div>
      <div className="flex-1">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          {description}
        </p>
      </div>
      <Link
        href={href}
        className={cn(
          buttonVariants({
            variant: urgent ? "default" : "outline",
            size: "sm",
          }),
          "w-full justify-between sm:w-fit",
        )}
      >
        Open queue
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </Card>
  );
}

export default async function AdminOverviewPage() {
  const overview = await getAdminOperationsOverview();
  const ghostOnly =
    overview.accounts.cappers > 0 &&
    overview.accounts.cappers === overview.accounts.ghosts;

  const capabilities = [
    {
      href: "/admin/plays",
      title: "Published play ledger",
      description:
        "Inspect every public straight play and parlay, review settlement history, and open correction controls.",
      evidence: `${overview.plays.published.toLocaleString()} published positions`,
      icon: ClipboardList,
    },
    {
      href: "/admin/grading",
      title: "Grading and corrections",
      description:
        "Run automatic grading, correct a misgrade with a reason, and preserve the before-and-after audit trail.",
      evidence: `${overview.plays.pendingGrade.toLocaleString()} awaiting grade`,
      icon: ClipboardCheck,
    },
    {
      href: "/admin/cappers",
      title: "Capper management",
      description:
        "Search capper accounts, inspect activity and storefront status, then activate, suspend, or disable access.",
      evidence: `${overview.accounts.cappers.toLocaleString()} capper accounts`,
      icon: UserRoundCog,
    },
    {
      href: "/admin/store-setup",
      title: "Winible and Whop workflow",
      description:
        "Review affiliate status, approve or suspend storefronts, record internal notes, and inspect review history.",
      evidence: `${overview.storefronts.total} workflow examples`,
      icon: Store,
    },
    {
      href: "/admin/store-setup",
      title: "Packages and tracked links",
      description:
        "Edit package copy, price, trial terms, checkout URL, visibility, display order, and tracked destinations.",
      evidence: `${overview.storefronts.packages} packages · ${overview.storefronts.trackedClicks} clicks`,
      icon: PackageCheck,
    },
    {
      href: "/admin/policies",
      title: "Policy publishing",
      description:
        "Edit Terms, Privacy, Disclaimer, and Responsible Gaming documents while retaining revision history.",
      evidence: `${overview.policies.documents} documents · ${overview.policies.revisions} revisions`,
      icon: FileText,
    },
  ];

  return (
    <div className="space-y-8">
      <SectionHeader
        icon={Gavel}
        title="Admin Operations"
        subtitle="Marketplace control center"
      />

      {overview.accounts.ghosts > 0 ? (
        <Card className="border-[color:var(--scl-blue)]/30 bg-[color:var(--scl-blue)]/5 p-4">
          <div className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[color:var(--scl-blue)]/10 text-[color:var(--scl-blue)]">
              <TestTube2 className="size-5" aria-hidden />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">Ghost operations workspace</h2>
                <Badge variant="outline">
                  {overview.accounts.ghosts} test cappers
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                {ghostOnly
                  ? "Every current capper is marked as test data. Use these records to rehearse admin workflows without affecting a real capper."
                  : "Ghost records are marked as test data and provide safe examples for rehearsing admin workflows."}
                {
                  " Storefront examples remain non-public until a real storefront is reviewed and marked live."
                }
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="p-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatBlock
            label="Capper accounts"
            value={overview.accounts.cappers}
          />
          <StatBlock
            label="Published positions"
            value={overview.plays.published}
          />
          <StatBlock
            label="Pending grades"
            value={overview.plays.pendingGrade}
            tone="pink"
          />
          <StatBlock
            label="Storefront cases"
            value={overview.storefronts.total}
          />
        </div>
      </Card>

      <section className="space-y-4">
        <SectionHeader
          icon={Activity}
          title="Operations queue"
          subtitle="Live work requiring an admin decision"
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <QueueCard
            href="/admin/store-setup"
            title="Affiliate review"
            description="Winible invitations and Whop link imports waiting for SCL."
            count={overview.storefronts.pendingReview}
            countLabel="waiting"
            urgent={overview.storefronts.pendingReview > 0}
            icon={FileClock}
          />
          <QueueCard
            href="/admin/store-setup"
            title="Needs attention"
            description="Storefronts with package details or checkout terms that need correction."
            count={overview.storefronts.needsAttention}
            countLabel="flagged"
            urgent={overview.storefronts.needsAttention > 0}
            icon={AlertTriangle}
          />
          <QueueCard
            href="/admin/grading"
            title="Pending grading"
            description="Unsettled straight plays and parlays ready for grading review."
            count={overview.plays.pendingGrade}
            countLabel="pending"
            icon={ClipboardCheck}
          />
          <QueueCard
            href="/admin/cappers"
            title="Suspended access"
            description="Capper accounts or storefronts currently held from normal operation."
            count={overview.accounts.suspended + overview.storefronts.suspended}
            countLabel="held"
            icon={Users}
          />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          icon={BadgeCheck}
          title="Functional capabilities"
          subtitle="Each card opens the working admin control and shows current evidence"
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {capabilities.map((capability) => {
            const Icon = capability.icon;
            return (
              <Link
                key={`${capability.href}-${capability.title}`}
                href={capability.href}
                className="focus-visible:ring-ring group rounded-xl outline-none focus-visible:ring-2"
              >
                <Card className="flex h-full min-h-52 flex-col gap-4 p-4 transition-colors group-hover:bg-[color:var(--scl-surface-2)]">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[color:var(--scl-line)] bg-[color:var(--scl-ink-700)] text-[color:var(--scl-blue)]">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <ArrowRight
                      className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{capability.title}</h3>
                    <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                      {capability.description}
                    </p>
                  </div>
                  <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[color:var(--scl-blue)] uppercase">
                    <BadgeCheck className="size-4" aria-hidden />
                    {capability.evidence}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <Card className="p-4">
        <div className="flex items-start gap-3">
          <MousePointerClick
            className="mt-0.5 size-5 shrink-0 text-[color:var(--scl-blue)]"
            aria-hidden
          />
          <div>
            <h2 className="font-semibold">Current implementation boundary</h2>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Bulk email, customer-account messaging, adjustable affiliate
              percentages, and native sales reporting are not active controls
              yet. Store package administration and click tracking are active;
              third-party sales and affiliate terms still live in Winible or
              Whop.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
