import { Store } from "lucide-react";

import { CapperCommerceControl } from "@/components/scl/capper-commerce-control";
import { PlatformStoreSettings } from "@/components/scl/platform-store-settings";
import { SectionHeader } from "@/components/scl/section";
import {
  getAdminCapperCommerceRows,
  getPlatformCommerceSettings,
} from "@/lib/queries/admin-sales";

export const metadata = { title: "Native store" };

export default async function AdminStorePage() {
  const [settings, cappers] = await Promise.all([
    getPlatformCommerceSettings(),
    getAdminCapperCommerceRows(),
  ]);

  return (
    <div className="space-y-8">
      <SectionHeader
        icon={Store}
        title="Native Store Controls"
        subtitle="Platform kill switch, default affiliate split, and per-capper native storefront approval"
      />

      <PlatformStoreSettings
        nativeStoreEnabled={settings.nativeStoreEnabled}
        platformAffiliatePercent={settings.platformAffiliatePercent}
      />

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase">
          Capper affiliate controls
        </h2>
        <div className="border-border overflow-hidden rounded-xl border">
          <div className="border-border bg-surface-2 text-muted-foreground hidden grid-cols-[minmax(0,1fr)_12rem] gap-4 border-b px-4 py-2 text-xs font-semibold uppercase md:grid">
            <span>Capper</span>
            <span>Native store / affiliate %</span>
          </div>
          <div className="divide-border divide-y">
            {cappers.map((capper) => (
              <article
                key={capper.id}
                className="bg-card grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_12rem] md:items-center"
              >
                <div>
                  <p className="font-semibold">
                    {capper.user.username
                      ? `@${capper.user.username.replace(/^@/, "")}`
                      : capper.user.email}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {capper._count.packages} package(s) ·{" "}
                    {capper.storefrontStatus}
                  </p>
                </div>
                <CapperCommerceControl
                  capperProfileId={capper.id}
                  nativeStoreEnabled={capper.nativeStoreEnabled}
                  defaultAffiliatePercent={capper.defaultAffiliatePercent}
                  platformEnabled={settings.nativeStoreEnabled}
                />
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
