import { Store } from "lucide-react";
import { Suspense } from "react";

import { MonetizationWizard } from "@/components/scl/monetization-wizard";
import { WhopOAuthNotice } from "@/components/scl/whop-oauth-notice";
import { SectionHeader } from "@/components/scl/section";
import { PackageCard } from "@/components/scl/package-card";
import { getCurrentUser } from "@/lib/session";
import {
  getCapperProfileIdForUser,
  getOwnerLivePackagesForCapper,
  listConnectionsForCapper,
} from "@/lib/queries/store";

export const metadata = { title: "Storefront" };

export default async function MonetizationPage() {
  // Layout already ran requireCapperAccess — reuse cached session user.
  const user = await getCurrentUser();
  if (!user) return null;

  const capperId = await getCapperProfileIdForUser(user.id);
  const [connections, livePackages] = capperId
    ? await Promise.all([
        listConnectionsForCapper(capperId),
        getOwnerLivePackagesForCapper(capperId),
      ])
    : [[], []];

  // Offers carried over from the previous platform are already public and
  // taking money, but they have no connection behind them — so the setup copy
  // told 56 cappers to "set up" a storefront that was live on their profile.
  // With no connections at all, every live package is necessarily unattached.
  const carriedOver = connections.length ? [] : livePackages;
  const hasCarriedStorefront = carriedOver.length > 0;

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <WhopOAuthNotice />
      </Suspense>
      <SectionHeader
        icon={Store}
        title={
          hasCarriedStorefront
            ? "Your SCL Storefront"
            : "Set Up Your SCL Storefront"
        }
        subtitle={
          hasCarriedStorefront
            ? "Your packages came over from the previous platform and are live on your profile. Connect Winible or Whop below only when you want to add or change offers."
            : "Connect Winible, Whop, or both. You confirm each affiliate relationship; SCL then reviews and manually publishes the approved package links."
        }
      />

      {hasCarriedStorefront ? (
        <p className="border-border bg-surface-2 rounded-xl border p-4 text-sm leading-relaxed">
          <span className="text-foreground font-semibold">
            {carriedOver.length} package{carriedOver.length === 1 ? "" : "s"}{" "}
            carried over and live.
          </span>{" "}
          <span className="text-muted-foreground">
            They already appear on your public profile and your checkout links
            work. Nothing here needs your attention unless you want to change
            them.
          </span>
        </p>
      ) : null}

      <MonetizationWizard
        connections={connections.map((c) => ({
          id: c.id,
          provider: c.provider,
          status: c.status,
          packageImportStatus: c.packageImportStatus,
          submittedAt: c.submittedAt,
        }))}
      />

      {livePackages.length ? (
        <section className="space-y-3">
          <h2 className="scl-display text-sm font-bold tracking-[0.08em] uppercase">
            Live packages (read-only)
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {livePackages.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
