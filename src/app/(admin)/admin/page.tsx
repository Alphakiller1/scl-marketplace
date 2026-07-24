import Link from "next/link";
import {
  BarChart3,
  DollarSign,
  FileText,
  Gavel,
  ListChecks,
  Mail,
  ShoppingBag,
  Store,
  Users,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { StatBlock } from "@/components/scl/stat";
import { SectionHeader } from "@/components/scl/section";

export const metadata = { title: "Admin" };

export default async function AdminOverviewPage() {
  const [cappers, customers, plays, pending, liveStorefronts, sales] =
    await Promise.all([
      prisma.capperProfile.count(),
      prisma.customerProfile.count(),
      prisma.play.count({ where: { parlayId: null } }),
      prisma.play.count({ where: { outcome: "PENDING", parlayId: null } }),
      prisma.capperProfile.count({
        where: { storefrontStatus: "STOREFRONT_LIVE" },
      }),
      prisma.packageSale.count({
        where: { status: { in: ["REPORTED", "CONFIRMED"] } },
      }),
    ]);

  return (
    <div className="space-y-8">
      <SectionHeader
        icon={Gavel}
        title="Admin Overview"
        subtitle="Operations across the SCL marketplace"
      />
      <Card className="p-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          <StatBlock label="Cappers" value={cappers} />
          <StatBlock label="Customers" value={customers} />
          <StatBlock label="Published plays" value={plays} />
          <StatBlock label="Pending grade" value={pending} tone="pink" />
          <StatBlock label="Live storefronts" value={liveStorefronts} />
          <StatBlock label="Recorded sales" value={sales} />
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Link
          href="/admin/plays"
          className="border-border bg-card rounded-xl border p-4"
        >
          <ListChecks className="text-brand size-5" />
          <h2 className="mt-3 font-semibold">Published plays</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Browse every committed play across cappers.
          </p>
        </Link>
        <Link
          href="/admin/storefronts"
          className="border-border bg-card rounded-xl border p-4"
        >
          <Store className="text-brand size-5" />
          <h2 className="mt-3 font-semibold">Storefront pipeline</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage Winible/Whop status, notes, and package links.
          </p>
        </Link>
        <Link
          href="/admin/store"
          className="border-border bg-card rounded-xl border p-4"
        >
          <Store className="text-brand size-5" />
          <h2 className="mt-3 font-semibold">Native store controls</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Platform kill switch and per-capper affiliate defaults.
          </p>
        </Link>
        <Link
          href="/admin/sales"
          className="border-border bg-card rounded-xl border p-4"
        >
          <DollarSign className="text-brand size-5" />
          <h2 className="mt-3 font-semibold">Sales reconciliation</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Record Winible/Whop sales and affiliate revenue manually.
          </p>
        </Link>
        <Link
          href="/admin/customers"
          className="border-border bg-card rounded-xl border p-4"
        >
          <ShoppingBag className="text-brand size-5" />
          <h2 className="mt-3 font-semibold">Customer accounts</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            View buyer signups, marketing opt-in, and admin notes.
          </p>
        </Link>
        <Link
          href="/admin/policies"
          className="border-border bg-card rounded-xl border p-4"
        >
          <FileText className="text-brand size-5" />
          <h2 className="mt-3 font-semibold">Policy CMS</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Publish versioned legal documents and trigger re-acceptance.
          </p>
        </Link>
        <Link
          href="/admin/communications"
          className="border-border bg-card rounded-xl border p-4"
        >
          <Mail className="text-brand size-5" />
          <h2 className="mt-3 font-semibold">Broadcasts</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Send bulk email to capper and customer audiences.
          </p>
        </Link>
        <Link
          href="/admin/cappers"
          className="border-border bg-card rounded-xl border p-4"
        >
          <Users className="text-brand size-5" />
          <h2 className="mt-3 font-semibold">Capper accounts</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Approve, suspend, or disable capper access.
          </p>
        </Link>
        <Link
          href="/admin/analytics"
          className="border-border bg-card rounded-xl border p-4"
        >
          <BarChart3 className="text-brand size-5" />
          <h2 className="mt-3 font-semibold">Click analytics</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Track package link performance and click-to-sale conversion.
          </p>
        </Link>
      </div>
    </div>
  );
}
