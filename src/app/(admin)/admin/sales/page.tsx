import { DollarSign } from "lucide-react";

import { PackageSaleForm } from "@/components/scl/package-sale-form";
import { SectionHeader } from "@/components/scl/section";
import {
  getAdminSales,
  getLivePackagesForSaleEntry,
  getSalesPerformanceSummary,
} from "@/lib/queries/admin-sales";
import {
  SALE_SOURCE_LABEL,
  SALE_STATUS_LABEL,
} from "@/lib/schemas/admin-commerce-phase-c.schema";

export const metadata = { title: "Sales reconciliation" };

function formatUsd(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export default async function AdminSalesPage() {
  const [summary, sales, packages] = await Promise.all([
    getSalesPerformanceSummary(),
    getAdminSales(),
    getLivePackagesForSaleEntry(),
  ]);

  return (
    <div className="space-y-8">
      <SectionHeader
        icon={DollarSign}
        title="Sales Reconciliation"
        subtitle="Manual Winible/Whop reporting, click attribution, and affiliate revenue tracking"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="border-border bg-card rounded-xl border p-4">
          <p className="text-muted-foreground text-xs uppercase">
            Tracked clicks
          </p>
          <p className="mt-2 text-2xl font-semibold">{summary.totalClicks}</p>
        </div>
        <div className="border-border bg-card rounded-xl border p-4">
          <p className="text-muted-foreground text-xs uppercase">
            Recorded sales
          </p>
          <p className="mt-2 text-2xl font-semibold">{summary.totalSales}</p>
        </div>
        <div className="border-border bg-card rounded-xl border p-4">
          <p className="text-muted-foreground text-xs uppercase">
            Gross revenue
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {formatUsd(summary.grossRevenueCents)}
          </p>
        </div>
        <div className="border-border bg-card rounded-xl border p-4">
          <p className="text-muted-foreground text-xs uppercase">
            Affiliate revenue
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {formatUsd(summary.affiliateRevenueCents)}
          </p>
        </div>
      </div>

      <PackageSaleForm packages={packages} />

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase">Recent sales</h2>
        {sales.length ? (
          <div className="border-border divide-border divide-y overflow-hidden rounded-xl border">
            {sales.map((sale) => (
              <article key={sale.id} className="bg-card p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{sale.package.title}</p>
                  <span className="text-muted-foreground text-xs">
                    {sale.purchasedAt.toLocaleString()}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1">
                  {SALE_SOURCE_LABEL[sale.source]} ·{" "}
                  {SALE_STATUS_LABEL[sale.status]} ·{" "}
                  {formatUsd(sale.grossCents)} gross ·{" "}
                  {sale.affiliateCents != null
                    ? `${formatUsd(sale.affiliateCents)} affiliate (${sale.affiliatePercent}%)`
                    : "No affiliate calc"}
                </p>
                {sale.externalOrderId ? (
                  <p className="text-muted-foreground mt-1 text-xs">
                    Order {sale.externalOrderId}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No sales recorded yet.
          </p>
        )}
      </section>
    </div>
  );
}
