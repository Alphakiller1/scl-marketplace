import Link from "next/link";
import type { Outcome } from "@prisma/client";
import {
  Activity,
  ArrowLeft,
  ExternalLink,
  History,
  MailCheck,
  PackageOpen,
  Scale,
  ShieldCheck,
  Store,
  UserRound,
} from "lucide-react";
import { notFound } from "next/navigation";

import { AccountStatusControl } from "@/components/scl/account-status-control";
import { AccountStatusBadge } from "@/components/scl/account-trust";
import { StatusBadge } from "@/components/scl/badges";
import { AdminPackageForm } from "@/components/scl/admin-package-form";
import { ProviderBadge } from "@/components/scl/provider-badge";
import { SectionHeader } from "@/components/scl/section";
import { StoreStatusChip } from "@/components/scl/store-status-chip";
import { Button } from "@/components/ui/button";
import { formatUnits, signTone } from "@/lib/format";
import {
  formatPriceCents,
  importStatusLabel,
  providerLabel,
} from "@/lib/store-connection";
import { getAdminCapperDetail } from "@/lib/queries/admin-cappers";
import { cn } from "@/lib/utils";

export const metadata = { title: "Capper review" };

const dateTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const OUTCOME_TO_STATUS = {
  PENDING: "pending",
  WIN: "win",
  LOSS: "loss",
  PUSH: "push",
  VOID: "void",
} as const;

export default async function AdminCapperDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const capper = await getAdminCapperDetail(id);
  if (!capper) notFound();

  const profile = capper.capperProfile;
  const summary = capper.summary;
  const handle = capper.username?.replace(/^@/, "") ?? null;
  const name =
    capper.displayName?.trim() || (handle ? `@${handle}` : capper.email);
  const latestAcceptance = capper.termsAcceptances[0] ?? null;
  // The quick-package form was pinned to Winible. For a Whop capper that both
  // mislabelled the storefront as "not started" and would have created the
  // package under the wrong platform — the form's Platform field is read-only
  // and takes whatever provider it is handed.
  const primaryConnection =
    profile?.storeConnections.find(
      (connection) => connection.status === "LIVE",
    ) ??
    profile?.storeConnections[0] ??
    null;
  const quickPackageProvider = primaryConnection?.provider ?? "WINIBLE";

  return (
    <div className="space-y-6">
      <Button
        size="sm"
        variant="ghost"
        render={<Link href="/admin/cappers" />}
        nativeButton={false}
      >
        <ArrowLeft className="size-4" />
        Back to capper accounts
      </Button>

      <section className="border-border bg-card space-y-5 rounded-xl border p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold break-words">{name}</h1>
              <AccountStatusBadge status={capper.accountStatus} />
              {capper.isTest ? <SmallFlag label="Test account" /> : null}
              {profile?.isLegacy ? <SmallFlag label="Legacy" /> : null}
            </div>
            <p className="text-muted-foreground mt-1 text-sm break-all">
              {capper.email}
              {handle ? ` · @${handle}` : ""}
            </p>
            <p className="text-muted-foreground mt-2 text-xs">
              Joined {dateTime.format(capper.createdAt)} · Account updated{" "}
              {dateTime.format(capper.updatedAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {handle ? (
              <Button
                size="sm"
                variant="outline"
                render={<Link href={`/cappers/${handle}`} />}
                nativeButton={false}
              >
                Public profile
                <ExternalLink className="size-4" />
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              render={
                <Link
                  href={`/admin/plays?search=${encodeURIComponent(handle || capper.email)}`}
                />
              }
              nativeButton={false}
            >
              Published plays
            </Button>
          </div>
        </div>

        <dl
          className={cn(
            "grid gap-3 sm:grid-cols-2",
            summary?.carriedRecord ? "xl:grid-cols-6" : "xl:grid-cols-5",
          )}
        >
          <Metric
            label="Straight plays"
            value={summary?.straightCount.toLocaleString() ?? "0"}
          />
          <Metric
            label="Parlays"
            value={summary?.parlayCount.toLocaleString() ?? "0"}
          />
          {/*
            Results carried over from the previous platform. Shown as its own
            metric rather than folded into the play counts, because it has no
            pick-level evidence behind it — the distinction is the whole point.
            Net units below does include it, so ROI reads against the full book.
          */}
          {summary?.carriedRecord ? (
            <Metric
              label="Carried record"
              value={`${summary.carriedRecord.w}-${summary.carriedRecord.l}-${summary.carriedRecord.p}`}
              hint={`${summary.carriedSettled.toLocaleString()} settled · ${formatUnits(summary.carriedUnits)}`}
            />
          ) : null}
          <Metric
            label="Net units"
            value={summary ? formatUnits(summary.netUnits) : "0U"}
            tone={summary ? signTone(summary.netUnits) : "muted"}
            hint={summary?.carriedRecord ? "includes carried" : undefined}
          />
          <Metric
            label="Packages"
            value={summary?.packageCount.toLocaleString() ?? "0"}
          />
          <Metric
            label="Tracked clicks"
            value={summary?.clickCount.toLocaleString() ?? "0"}
          />
        </dl>
      </section>

      {/*
        items-start, and the denser column is the wider one. Account Control is
        a short form; Profile is a long attribute list. Stretching them to equal
        height left a screen's worth of dead space under the controls, which
        read as a broken panel rather than a compact one.
      */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(24rem,1.1fr)]">
        <section className="border-border bg-card space-y-4 rounded-xl border p-4 sm:p-5">
          <SectionHeader
            icon={ShieldCheck}
            title="Account Control"
            subtitle="Status changes are recorded in the immutable lifecycle history"
          />
          <AccountStatusControl
            userId={capper.id}
            currentStatus={capper.accountStatus}
          />
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <TrustLine
              icon={MailCheck}
              label="Email"
              value={
                capper.emailVerified
                  ? `Verified ${dateTime.format(capper.emailVerified)}`
                  : "Not verified"
              }
            />
            <TrustLine
              icon={Scale}
              label="Policies"
              value={
                latestAcceptance
                  ? `Accepted ${latestAcceptance.policyVersion} · ${dateTime.format(latestAcceptance.acceptedAt)}`
                  : "No acceptance recorded"
              }
            />
          </div>
        </section>

        <section className="border-border bg-card space-y-4 rounded-xl border p-4 sm:p-5">
          <SectionHeader
            icon={UserRound}
            title="Profile"
            subtitle={
              profile
                ? `Last updated ${dateTime.format(profile.updatedAt)}`
                : "Profile has not been created"
            }
          />
          {profile ? (
            <>
              {profile.headline || profile.bio ? (
                <div className="bg-surface-2 space-y-1 rounded-lg p-3 text-sm">
                  {profile.headline ? (
                    <p className="font-semibold">{profile.headline}</p>
                  ) : null}
                  {profile.bio ? (
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {profile.bio}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <dl className="grid gap-3 text-sm">
                <DetailLine
                  label="Provider model"
                  value={profile.providerType.replaceAll("_", " ")}
                />
                <DetailLine
                  label="Daily volume"
                  value={profile.dailyVolume?.replaceAll("_", " ") || "Unset"}
                />
                <DetailLine
                  label="Analysis"
                  value={profile.writtenAnalysis ? "Provided" : "Not provided"}
                />
                <DetailLine
                  label="Storefront display"
                  value={profile.storefrontEnabled ? "Enabled" : "Hidden"}
                />
                <DetailLine
                  label="Specialties"
                  value={profile.specialties.join(", ") || "None selected"}
                />
                <DetailLine
                  label="Books"
                  value={profile.books.join(", ") || "All / not specified"}
                />
                <DetailLine
                  label="Bet types"
                  value={
                    profile.betTypes
                      .map((type) => type.replaceAll("_", " "))
                      .join(", ") || "None selected"
                  }
                />
              </dl>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              The account exists, but it has no capper profile record.
            </p>
          )}
        </section>
      </div>

      <section className="space-y-4">
        <SectionHeader
          icon={Store}
          title="Storefront Status"
          subtitle="Platform workflow, import state, package coverage, and internal notes"
        />
        {profile?.storeConnections.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {profile.storeConnections.map((connection) => (
              <article
                key={connection.id}
                className="border-border bg-card space-y-4 rounded-xl border p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <ProviderBadge provider={connection.provider} />
                  <StoreStatusChip status={connection.status} />
                </div>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <DetailLine
                    label="Package import"
                    value={importStatusLabel(connection.packageImportStatus)}
                  />
                  <DetailLine
                    label="Packages"
                    value={connection._count.packages.toLocaleString()}
                  />
                  <DetailLine
                    label="Submitted"
                    value={
                      connection.submittedAt
                        ? dateTime.format(connection.submittedAt)
                        : "Not submitted"
                    }
                  />
                  <DetailLine
                    label="Last human review"
                    value={
                      connection.reviewedAt
                        ? `${connection.reviewedBy?.displayName?.trim() || connection.reviewedBy?.username || connection.reviewedBy?.email || "Administrator"} · ${dateTime.format(connection.reviewedAt)}`
                        : "Not reviewed"
                    }
                  />
                  <DetailLine
                    label="Last operational update"
                    value={dateTime.format(connection.updatedAt)}
                  />
                </dl>
                {connection.adminNotes ? (
                  <div className="bg-surface-2 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs font-semibold uppercase">
                      Internal notes
                    </p>
                    <p className="mt-1 text-sm whitespace-pre-wrap">
                      {connection.adminNotes}
                    </p>
                  </div>
                ) : null}
                <Button
                  size="sm"
                  variant="secondary"
                  render={
                    <Link href={`/admin/store-setup?id=${connection.id}`} />
                  }
                  nativeButton={false}
                >
                  Manage storefront
                  <ExternalLink className="size-4" />
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <p className="border-border bg-card text-muted-foreground rounded-xl border p-5 text-sm">
            No Winible or Whop storefront workflow has been started.
          </p>
        )}
      </section>

      <section className="space-y-4">
        <SectionHeader
          icon={PackageOpen}
          title="Packages & Clicks"
          subtitle="Current display order, visibility, platform, price, and tracked traffic"
          href={
            primaryConnection
              ? `/admin/store-setup?id=${primaryConnection.id}`
              : undefined
          }
          hrefLabel="Manage packages"
        />
        {profile &&
        (profile.storefrontTitle || profile.storefrontDescription) ? (
          <div className="border-border bg-card rounded-xl border p-4">
            <p className="font-semibold">
              {profile.storefrontTitle || "Storefront"}
            </p>
            {profile.storefrontDescription ? (
              <p className="text-muted-foreground mt-1 text-sm whitespace-pre-wrap">
                {profile.storefrontDescription}
              </p>
            ) : null}
          </div>
        ) : null}
        {profile?.packages.length ? (
          <div className="border-border overflow-hidden rounded-xl border">
            <div className="divide-border divide-y">
              {profile.packages.map((pkg) => {
                const clicks = pkg.trackingUrls.reduce(
                  (total, url) => total + url._count.clicks,
                  0,
                );
                return (
                  <article
                    key={pkg.id}
                    className="bg-card grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_8rem_7rem_6rem] md:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold">{pkg.title}</h3>
                        <StoreStatusChip
                          status={pkg.isActive ? "LIVE" : "NOT_STARTED"}
                          label={pkg.isActive ? "Visible" : "Hidden"}
                        />
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">
                        Display order {pkg.sortOrder} · Updated{" "}
                        {dateTime.format(pkg.updatedAt)}
                      </p>
                    </div>
                    <div>
                      {pkg.affiliateProvider ? (
                        <ProviderBadge provider={pkg.affiliateProvider} />
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          No platform
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatPriceCents(pkg.priceCents, pkg.billingPeriod) ||
                        "No price"}
                    </p>
                    <p className="text-sm font-semibold tabular-nums">
                      {clicks.toLocaleString()}{" "}
                      <span className="text-muted-foreground font-normal">
                        clicks
                      </span>
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="border-border bg-card text-muted-foreground rounded-xl border p-5 text-sm">
            No packages have been created for this capper.
          </p>
        )}

        {/*
          Attribution for offer changes. Package price and visibility decide
          what the public can buy, so "who hid this and when" needs an answer
          that does not depend on someone remembering.
        */}
        {profile?.packageAudits.length ? (
          <div className="border-border overflow-hidden rounded-xl border">
            <p className="border-border text-muted-foreground border-b px-4 py-2 text-xs font-semibold tracking-wide uppercase">
              Recent package changes
            </p>
            <ul className="divide-border divide-y">
              {profile.packageAudits.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-2.5 text-sm"
                >
                  <span className="min-w-0">
                    <span className="font-medium">
                      {event.summary ?? event.action}
                    </span>
                    <span className="text-muted-foreground">
                      {" · "}
                      {event.actor.displayName?.trim() ||
                        (event.actor.username
                          ? `@${event.actor.username.replace(/^@/, "")}`
                          : event.actor.email)}
                    </span>
                  </span>
                  <time
                    dateTime={event.createdAt.toISOString()}
                    className="text-muted-foreground shrink-0 text-xs tabular-nums"
                  >
                    {dateTime.format(event.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {profile ? (
        <section className="border-border bg-card space-y-4 rounded-xl border p-4 sm:p-5">
          <SectionHeader
            icon={PackageOpen}
            title={`Quick ${providerLabel(quickPackageProvider)} package`}
            subtitle={`Fast manual fallback when ${providerLabel(quickPackageProvider)} sync is unavailable — paste the link, price, promo, and description, then publish it to the capper profile.`}
          />
          <AdminPackageForm
            capperId={profile.id}
            storeConnectionId={primaryConnection?.id ?? null}
            provider={quickPackageProvider}
          />
        </section>
      ) : null}

      <section className="space-y-4">
        <SectionHeader
          icon={Activity}
          title="Recent Published Activity"
          subtitle="Latest straight plays and parlays, including result and review flags"
        />
        {profile && (profile.plays.length > 0 || profile.parlays.length > 0) ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <ActivityList
              title="Straight plays"
              empty="No straight plays"
              rows={profile.plays.map((play) => ({
                id: play.id,
                label: play.selection,
                detail: `${play.sport} · ${play.market}`,
                outcome: play.outcome,
                profitUnits:
                  play.profitUnits == null ? null : Number(play.profitUnits),
                createdAt: play.createdAt,
                needsReview: play.needsReview,
                href: `/admin/plays/straight/${play.id}`,
              }))}
            />
            <ActivityList
              title="Parlays"
              empty="No parlays"
              rows={profile.parlays.map((parlay) => ({
                id: parlay.id,
                label: `${parlay._count.legs}-leg parlay`,
                detail: "Parlay",
                outcome: parlay.outcome,
                profitUnits:
                  parlay.profitUnits == null
                    ? null
                    : Number(parlay.profitUnits),
                createdAt: parlay.createdAt,
                needsReview: false,
                href: `/admin/plays/parlay/${parlay.id}`,
              }))}
            />
          </div>
        ) : (
          <p className="border-border bg-card text-muted-foreground rounded-xl border p-5 text-sm">
            No published play activity is available.
          </p>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-4">
          <SectionHeader
            icon={History}
            title="Account Lifecycle History"
            subtitle="Administrator, reason, prior state, and timestamp"
          />
          {capper.statusChanges.length ? (
            <ol className="border-border divide-border divide-y overflow-hidden rounded-xl border">
              {capper.statusChanges.map((change) => {
                const actor =
                  change.changedBy.displayName?.trim() ||
                  change.changedBy.username ||
                  change.changedBy.email;
                return (
                  <li key={change.id} className="bg-card space-y-2 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <AccountStatusBadge status={change.previousStatus} />
                      <span aria-hidden>→</span>
                      <AccountStatusBadge status={change.newStatus} />
                    </div>
                    <p className="text-sm">
                      {change.reason || "No reason recorded"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {actor} · {dateTime.format(change.createdAt)}
                    </p>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="border-border bg-card text-muted-foreground rounded-xl border p-5 text-sm">
              No account status changes have been recorded.
            </p>
          )}
        </section>

        <section className="space-y-4">
          <SectionHeader
            icon={Scale}
            title="Policy Acceptance History"
            subtitle="Auditable versions of every required policy acknowledgement"
          />
          {capper.termsAcceptances.length ? (
            <ol className="border-border divide-border divide-y overflow-hidden rounded-xl border">
              {capper.termsAcceptances.map((acceptance) => (
                <li
                  key={acceptance.id}
                  className="bg-card flex flex-wrap items-center justify-between gap-2 p-4"
                >
                  <div className="min-w-0">
                    <p className="font-semibold">
                      Bundle {acceptance.policyVersion}
                    </p>
                    {acceptance.termsVersion ? (
                      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                        Terms {acceptance.termsVersion} · Privacy{" "}
                        {acceptance.privacyVersion} · Responsible Gaming{" "}
                        {acceptance.responsibleGamingVersion} · Refund{" "}
                        {acceptance.refundVersion}
                        {acceptance.acceptanceSource
                          ? ` · ${acceptance.acceptanceSource.toLowerCase()}`
                          : ""}
                      </p>
                    ) : (
                      <p className="text-muted-foreground mt-1 text-xs">
                        Legacy acceptance record
                      </p>
                    )}
                  </div>
                  <time className="text-muted-foreground text-sm tabular-nums">
                    {dateTime.format(acceptance.acceptedAt)}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="border-border bg-card text-muted-foreground rounded-xl border p-5 text-sm">
              No policy acceptance has been recorded.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function SmallFlag({ label }: { label: string }) {
  return (
    <span className="border-border bg-surface-2 text-muted-foreground rounded-md border px-2 py-1 text-[0.65rem] font-semibold uppercase">
      {label}
    </span>
  );
}

function Metric({
  label,
  value,
  tone = "muted",
  hint,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg" | "muted";
  /** Secondary line — provenance or a qualifier the number needs to be read correctly. */
  hint?: string;
}) {
  return (
    <div className="bg-surface-2 min-w-0 rounded-lg p-3">
      <dt className="text-muted-foreground text-xs font-semibold uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "scl-data mt-1 text-lg font-bold tabular-nums",
          tone === "pos" && "text-pos",
          tone === "neg" && "text-neg",
        )}
      >
        {value}
      </dd>
      {hint ? (
        <dd className="text-muted-foreground mt-0.5 text-[0.7rem] leading-snug">
          {hint}
        </dd>
      ) : null}
    </div>
  );
}

function TrustLine({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-surface-2 flex gap-3 rounded-lg p-3">
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <div>
        <p className="text-muted-foreground text-xs font-semibold uppercase">
          {label}
        </p>
        <p className="mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs font-semibold uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 break-words">{value}</dd>
    </div>
  );
}

type ActivityRow = {
  id: string;
  label: string;
  detail: string;
  outcome: Outcome;
  profitUnits: number | null;
  createdAt: Date;
  needsReview: boolean;
  href: string;
};

function ActivityList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: ActivityRow[];
}) {
  return (
    <div className="border-border overflow-hidden rounded-xl border">
      <h3 className="border-border bg-surface-2 border-b px-4 py-3 font-semibold">
        {title}
      </h3>
      {rows.length ? (
        <ol className="divide-border divide-y">
          {rows.map((row) => (
            <li
              key={row.id}
              className="bg-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={row.href} className="scl-link font-semibold">
                    {row.label}
                  </Link>
                  {row.needsReview ? (
                    <span className="border-neg/40 bg-neg/10 text-neg rounded-md border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase">
                      Review flag
                    </span>
                  ) : null}
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {row.detail} · {dateTime.format(row.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={OUTCOME_TO_STATUS[row.outcome]} />
                <span className="text-sm font-semibold tabular-nums">
                  {row.profitUnits == null
                    ? "Open"
                    : formatUnits(row.profitUnits)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="bg-card text-muted-foreground p-4 text-sm">{empty}</p>
      )}
    </div>
  );
}
