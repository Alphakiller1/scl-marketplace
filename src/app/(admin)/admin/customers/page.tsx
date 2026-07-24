import { Users } from "lucide-react";

import { AccountStatusBadge } from "@/components/scl/account-trust";
import { AccountStatusControl } from "@/components/scl/account-status-control";
import { EmptyState } from "@/components/scl/states";
import { SectionHeader } from "@/components/scl/section";
import { getAdminCustomerAccounts } from "@/lib/queries/admin-customers";

export const metadata = { title: "Customers" };

export default async function AdminCustomersPage() {
  const accounts = await getAdminCustomerAccounts();

  return (
    <div className="space-y-5">
      <SectionHeader
        icon={Users}
        title="Customer Accounts"
        subtitle="Marketplace buyers with SCL customer login and marketing preferences"
      />

      {accounts.length ? (
        <div className="border-border overflow-hidden rounded-xl border">
          <div className="border-border bg-surface-2 text-muted-foreground hidden grid-cols-[minmax(0,1fr)_7rem_7rem_5rem_1.4fr] gap-4 border-b px-4 py-2 text-xs font-semibold uppercase xl:grid">
            <span>Customer</span>
            <span>Status</span>
            <span>Marketing</span>
            <span>Sales</span>
            <span>Control</span>
          </div>
          <div className="divide-border divide-y">
            {accounts.map((account) => (
              <article
                key={account.id}
                className="bg-card grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_7rem_7rem_5rem_1.4fr] xl:items-center"
              >
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">
                    {account.displayName || account.email}
                  </h2>
                  <p className="text-muted-foreground truncate text-sm">
                    {account.email}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Joined {account.createdAt.toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <AccountStatusBadge status={account.accountStatus} />
                </div>
                <div className="text-sm">
                  {account.customerProfile?.marketingOptIn
                    ? "Opted in"
                    : "Opted out"}
                </div>
                <div className="nums text-sm font-semibold tabular-nums">
                  {account.customerProfile?._count.purchases ?? 0}
                </div>
                <AccountStatusControl
                  userId={account.id}
                  currentStatus={account.accountStatus}
                />
              </article>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="No Customer Accounts Yet"
          description="Customer signups will appear here once buyers create accounts at /signup/customer."
        />
      )}
    </div>
  );
}
