import Link from "next/link";
import { ArrowRight, ClipboardCheck, Gavel, Store, Users } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { StatBlock } from "@/components/scl/stat";
import { SectionHeader } from "@/components/scl/section";

export const metadata = { title: "Admin" };

const ADMIN_TOOLS = [
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
    title: "Storefront setup",
    description:
      "Track Winible and Whop onboarding, review packages, manage links, and monitor clicks.",
    icon: Store,
  },
];

export default async function AdminOverviewPage() {
  const [cappers, plays, pending] = await Promise.all([
    prisma.capperProfile.count(),
    prisma.play.count(),
    prisma.play.count({ where: { outcome: "PENDING" } }),
  ]);

  return (
    <div className="space-y-8">
      <SectionHeader
        icon={Gavel}
        title="Admin Overview"
        subtitle="Operations across the SCL marketplace"
      />
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatBlock label="Cappers" value={cappers} />
          <StatBlock label="Plays" value={plays} />
          <StatBlock label="Pending grade" value={pending} tone="pink" />
        </div>
      </Card>

      <section className="space-y-4">
        <SectionHeader
          title="Available tools"
          subtitle="These controls are live in the current admin panel"
        />
        <div className="grid gap-4 md:grid-cols-3">
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
    </div>
  );
}
