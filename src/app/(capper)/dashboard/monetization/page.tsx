import { Store } from "lucide-react";

import { MonetizationWizard } from "@/components/scl/monetization-wizard";
import { SectionHeader } from "@/components/scl/section";
import { PackageCard } from "@/components/scl/package-card";
import { requireCapperAccess } from "@/lib/session";
import {
  getCapperProfileIdForUser,
  getOwnerLivePackagesForCapper,
  listConnectionsForCapper,
} from "@/lib/queries/store";

export const metadata = { title: "Storefront" };

export default async function MonetizationPage() {
  const user = await requireCapperAccess();
  const capperId = await getCapperProfileIdForUser(user.id);
  const connections = capperId ? await listConnectionsForCapper(capperId) : [];
  const livePackages = capperId
    ? await getOwnerLivePackagesForCapper(capperId)
    : [];

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Store}
        title="Set Up Your SCL Storefront"
        subtitle="Connect Winible or Whop. You confirm the affiliate relationship — SCL imports links and publishes standardized packages."
      />

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
