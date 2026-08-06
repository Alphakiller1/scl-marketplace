import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";

import { AccountStatusBadge } from "@/components/scl/account-trust";
import { ProviderBadge } from "@/components/scl/provider-badge";
import { SectionHeader } from "@/components/scl/section";
import { EmptyState } from "@/components/scl/states";
import { StoreStatusChip } from "@/components/scl/store-status-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ADMIN_CAPPERS_PAGE_SIZE,
  adminCappersHref,
  parseAdminCapperFilters,
  type AdminCapperSearchParams,
} from "@/lib/admin-cappers";
import { getAdminCapperAccounts } from "@/lib/queries/admin-cappers";

export const metadata = { title: "Capper accounts" };

const selectClassName =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 min-h-10 rounded-lg border px-3 text-sm outline-none focus-visible:ring-3";

export default async function AdminCappersPage({
  searchParams,
}: {
  searchParams: Promise<AdminCapperSearchParams>;
}) {
  const filters = parseAdminCapperFilters(await searchParams);
  const result = await getAdminCapperAccounts(filters);
  const firstResult = result.total
    ? (result.page - 1) * ADMIN_CAPPERS_PAGE_SIZE + 1
    : 0;
  const lastResult = Math.min(
    result.page * ADMIN_CAPPERS_PAGE_SIZE,
    result.total,
  );

  return (
    <div className="space-y-5">
      <SectionHeader
        icon={Users}
        title="Capper Accounts"
        subtitle={`${result.total.toLocaleString()} matching accounts · access, verification, storefront, and activity review`}
      />

      <form
        action="/admin/cappers"
        className="border-border bg-card grid gap-3 rounded-xl border p-4 md:grid-cols-2 xl:grid-cols-[minmax(16rem,1.5fr)_repeat(4,minmax(8rem,1fr))_auto]"
      >
        <label className="space-y-1 md:col-span-2 xl:col-span-1">
          <span className="text-muted-foreground text-xs font-semibold uppercase">
            Search
          </span>
          <span className="relative block">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              name="q"
              defaultValue={filters.search}
              placeholder="Name, username, or email"
              className="pl-9"
            />
          </span>
        </label>
        <FilterSelect
          label="Account"
          name="status"
          value={filters.status}
          options={[
            ["all", "All statuses"],
            ["pending", "Pending"],
            ["active", "Active"],
            ["suspended", "Suspended"],
            ["disabled", "Disabled"],
          ]}
        />
        <FilterSelect
          label="Email"
          name="verification"
          value={filters.verification}
          options={[
            ["all", "Any verification"],
            ["verified", "Verified"],
            ["unverified", "Unverified"],
          ]}
        />
        <FilterSelect
          label="Visibility"
          name="scope"
          value={filters.scope}
          options={[
            ["all", "Public + test"],
            ["public", "Public only"],
            ["test", "Test only"],
          ]}
        />
        <FilterSelect
          label="Storefront"
          name="storefront"
          value={filters.storefront}
          options={[
            ["all", "Any storefront"],
            ["none", "Not started"],
            ["pending", "Pending review"],
            ["live", "Live"],
            ["attention", "Needs attention"],
          ]}
        />
        <div className="flex items-end gap-2">
          <Button type="submit" className="flex-1">
            <SlidersHorizontal className="size-4" />
            Apply
          </Button>
          <Button
            variant="ghost"
            render={<Link href="/admin/cappers" />}
            nativeButton={false}
          >
            Reset
          </Button>
        </div>
      </form>

      {result.rows.length ? (
        <>
          <div className="border-border overflow-hidden rounded-xl border">
            <div className="border-border bg-surface-2 text-muted-foreground hidden grid-cols-[minmax(0,1.35fr)_8rem_9rem_8rem_auto] gap-4 border-b px-4 py-2 text-xs font-semibold uppercase lg:grid">
              <span>Capper</span>
              <span>Account</span>
              <span>Activity</span>
              <span>Storefront</span>
              <span>Review</span>
            </div>
            <div className="divide-border divide-y">
              {result.rows.map((account) => {
                const profile = account.capperProfile;
                const name =
                  account.displayName?.trim() ||
                  (account.username
                    ? `@${account.username.replace(/^@/, "")}`
                    : account.email);
                const latestPick = profile?.plays[0]?.createdAt ?? null;
                const carried = profile?.legacyRecords[0] ?? null;

                return (
                  <article
                    key={account.id}
                    className="bg-card grid gap-4 p-4 lg:grid-cols-[minmax(0,1.35fr)_8rem_9rem_8rem_auto] lg:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate font-semibold">{name}</h2>
                        {account.isTest ? (
                          <span className="border-border bg-surface-2 text-muted-foreground rounded-md border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase">
                            Test
                          </span>
                        ) : null}
                        {profile?.isLegacy ? (
                          <span className="border-border bg-surface-2 text-muted-foreground rounded-md border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase">
                            Legacy
                          </span>
                        ) : null}
                      </div>
                      <p className="text-muted-foreground truncate text-sm">
                        {account.email}
                      </p>
                      <p className="text-muted-foreground mt-1 truncate text-xs">
                        {profile?.sports.length
                          ? profile.sports.join(" · ")
                          : "No sports selected"}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <AccountStatusBadge status={account.accountStatus} />
                      <p className="text-muted-foreground text-xs">
                        {account.emailVerified
                          ? "Email verified"
                          : "Email unverified"}
                      </p>
                    </div>

                    <div className="text-sm">
                      <p className="font-semibold tabular-nums">
                        {profile?._count.plays ?? 0} plays ·{" "}
                        {profile?._count.parlays ?? 0} parlays
                      </p>
                      {/*
                        An imported capper has almost no plays on SCL yet but can
                        carry a four-figure record from the previous platform.
                        Showing only the play count made them read as inactive.
                      */}
                      {carried ? (
                        <p className="text-muted-foreground mt-1 text-xs tabular-nums">
                          <span className="text-foreground font-semibold">
                            +{carried.wins}-{carried.losses}-{carried.pushes}
                          </span>{" "}
                          carried
                        </p>
                      ) : null}
                      <p className="text-muted-foreground mt-1 text-xs">
                        {latestPick
                          ? `Last pick ${latestPick.toLocaleDateString()}`
                          : carried
                            ? "No picks on SCL yet"
                            : "No picks yet"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {profile && !profile.storefrontEnabled ? (
                        <SmallFlag label="Storefront hidden" />
                      ) : null}
                      {profile?.storeConnections.length ? (
                        profile.storeConnections.map((connection) => (
                          <span
                            key={connection.id}
                            className="flex flex-wrap items-center gap-1"
                          >
                            <ProviderBadge provider={connection.provider} />
                            <StoreStatusChip status={connection.status} />
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          Not started
                        </span>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant="secondary"
                      className="min-h-10 w-full lg:w-auto"
                      render={<Link href={`/admin/cappers/${account.id}`} />}
                      nativeButton={false}
                    >
                      Review
                      <ArrowRight className="size-4" />
                    </Button>
                  </article>
                );
              })}
            </div>
          </div>

          <nav
            aria-label="Capper account pages"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-muted-foreground text-sm tabular-nums">
              Showing {firstResult.toLocaleString()}–
              {lastResult.toLocaleString()} of {result.total.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={result.page <= 1}
                render={
                  result.page > 1 ? (
                    <Link href={adminCappersHref(filters, result.page - 1)} />
                  ) : undefined
                }
                nativeButton={result.page <= 1}
              >
                <ArrowLeft className="size-4" />
                Previous
              </Button>
              <span className="text-muted-foreground px-1 text-sm tabular-nums">
                Page {result.page} of {result.totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={result.page >= result.totalPages}
                render={
                  result.page < result.totalPages ? (
                    <Link href={adminCappersHref(filters, result.page + 1)} />
                  ) : undefined
                }
                nativeButton={result.page >= result.totalPages}
              >
                Next
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </nav>
        </>
      ) : (
        <EmptyState
          icon={Users}
          title="No matching capper accounts"
          description="Adjust the filters or clear the search to view other accounts."
          action={
            <Button
              variant="outline"
              render={<Link href="/admin/cappers" />}
              nativeButton={false}
            >
              Clear filters
            </Button>
          }
        />
      )}
    </div>
  );
}

function FilterSelect({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <label className="space-y-1">
      <span className="text-muted-foreground text-xs font-semibold uppercase">
        {label}
      </span>
      <select
        name={name}
        defaultValue={value}
        className={`${selectClassName} w-full`}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function SmallFlag({ label }: { label: string }) {
  return (
    <span className="border-border bg-surface-2 text-muted-foreground rounded-md border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase">
      {label}
    </span>
  );
}
