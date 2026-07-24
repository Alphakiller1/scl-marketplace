import { BarChart3 } from "lucide-react";

import { SectionHeader } from "@/components/scl/section";

import { EmptyState } from "@/components/scl/states";

import { StatBlock } from "@/components/scl/stat";

import { Card } from "@/components/ui/card";

import { getAdminClickAnalytics } from "@/lib/queries/admin-analytics";

import { getSalesPerformanceSummary } from "@/lib/queries/admin-sales";

export const metadata = { title: "Analytics" };

function formatUsd(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export default async function AdminAnalyticsPage() {
  const [analytics, sales] = await Promise.all([
    getAdminClickAnalytics(),

    getSalesPerformanceSummary(),
  ]);

  return (
    <div className="space-y-8">
      <SectionHeader
        icon={BarChart3}
        title="Storefront Analytics"
        subtitle="Click tracking, manual sale reconciliation, and affiliate performance"
      />

      <Card className="p-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatBlock label="Tracked clicks" value={sales.totalClicks} />

          <StatBlock label="Recorded sales" value={sales.totalSales} />

          <StatBlock
            label="Click → sale rate"
            value={`${sales.clickToSaleRate.toFixed(1)}%`}
          />

          <StatBlock
            label="Gross revenue"
            value={formatUsd(sales.grossRevenueCents)}
          />

          <StatBlock
            label="Affiliate revenue"
            value={formatUsd(sales.affiliateRevenueCents)}
          />
        </div>
      </Card>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase">By package</h2>

        {sales.packageRows.length ? (
          <div className="border-border overflow-hidden rounded-xl border">
            <div className="divide-border divide-y">
              {sales.packageRows.map((row) => (
                <article
                  key={row.packageId}
                  className="bg-card grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_6rem_6rem_6rem_6rem]"
                >
                  <div>
                    <p className="font-semibold">{row.title}</p>

                    <p className="text-muted-foreground text-sm">
                      {row.capper}
                    </p>

                    <p className="text-muted-foreground mt-1 text-xs">
                      {row.affiliatePercent}% affiliate ·{" "}
                      {formatUsd(row.priceCents ?? 0)}
                    </p>
                  </div>

                  <div className="self-center text-sm">
                    <p className="text-muted-foreground text-xs uppercase">
                      Clicks
                    </p>

                    <p className="nums font-semibold tabular-nums">
                      {row.clicks}
                    </p>
                  </div>

                  <div className="self-center text-sm">
                    <p className="text-muted-foreground text-xs uppercase">
                      Sales
                    </p>

                    <p className="nums font-semibold tabular-nums">
                      {row.sales}
                    </p>
                  </div>

                  <div className="self-center text-sm">
                    <p className="text-muted-foreground text-xs uppercase">
                      Conv.
                    </p>

                    <p className="nums font-semibold tabular-nums">
                      {row.conversionRate.toFixed(1)}%
                    </p>
                  </div>

                  <div className="self-center text-sm">
                    <p className="text-muted-foreground text-xs uppercase">
                      Tracked
                    </p>

                    <p className="text-muted-foreground text-xs">/go link</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={BarChart3}
            title="No Package Performance Yet"
            description="Live packages with tracked links and recorded sales will populate this report."
          />
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase">Recent clicks</h2>

        {analytics.recentClicks.length ? (
          <div className="border-border overflow-hidden rounded-xl border">
            <div className="divide-border divide-y">
              {analytics.recentClicks.map((row, index) => (
                <article
                  key={`${row.slug}-${index}`}
                  className="bg-card p-4 text-sm"
                >
                  <p className="font-medium">
                    {row.packageTitle} · {row.capper}
                  </p>

                  <p className="text-muted-foreground mt-1">
                    {row.createdAt.toLocaleString()} · /go/{row.slug}
                  </p>

                  {row.referrer ? (
                    <p className="text-muted-foreground mt-1 truncate text-xs">
                      Referrer: {row.referrer}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No click events recorded yet.
          </p>
        )}
      </section>
    </div>
  );
}
