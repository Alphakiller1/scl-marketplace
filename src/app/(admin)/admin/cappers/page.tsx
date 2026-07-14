import { Users } from "lucide-react";

import { AccountStatusBadge } from "@/components/scl/account-trust";
import { AccountStatusControl } from "@/components/scl/account-status-control";
import { EmptyState } from "@/components/scl/states";
import { SectionHeader } from "@/components/scl/section";
import { getAdminCapperAccounts } from "@/lib/queries/admin-cappers";

export const metadata = { title: "Capper accounts" };

export default async function AdminCappersPage() {
  const accounts = await getAdminCapperAccounts();

  return (
    <div className="space-y-5">
      <SectionHeader
        icon={Users}
        title="Capper Accounts"
        subtitle="Account access, verification, and status controls"
      />

      {accounts.length ? (
        <div className="border-border overflow-hidden rounded-xl border">
          <div className="border-border bg-surface-2 text-muted-foreground hidden grid-cols-[minmax(0,1fr)_7rem_5rem_1.4fr] gap-4 border-b px-4 py-2 text-xs font-semibold uppercase md:grid">
            <span>Capper</span>
            <span>Status</span>
            <span>Plays</span>
            <span>Control</span>
          </div>
          <div className="divide-border divide-y">
            {accounts.map((account) => (
              <article
                key={account.id}
                className="bg-card grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_7rem_5rem_1.4fr] md:items-center"
              >
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">
                    {account.username
                      ? `@${account.username.replace(/^@/, "")}`
                      : account.email}
                  </h2>
                  <p className="text-muted-foreground truncate text-sm">
                    {account.email}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {account.emailVerified ? "Email verified" : "Email pending"}
                  </p>
                </div>
                <div>
                  <AccountStatusBadge status={account.accountStatus} />
                </div>
                <div className="nums text-sm font-semibold tabular-nums">
                  {account.capperProfile?._count.plays ?? 0}
                  <span className="text-muted-foreground ml-1 font-normal md:hidden">
                    plays
                  </span>
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
          title="No Capper Accounts"
          description="Self-service capper accounts will appear here after signup."
        />
      )}
    </div>
  );
}
