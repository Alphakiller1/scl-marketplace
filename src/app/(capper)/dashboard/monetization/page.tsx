import { Store } from "lucide-react";
import { Suspense } from "react";

import { CapperWhopPackageEditor } from "@/components/scl/capper-whop-package-editor";
import { MonetizationWizard } from "@/components/scl/monetization-wizard";
import { WhopOAuthNotice } from "@/components/scl/whop-oauth-notice";
import { SectionHeader } from "@/components/scl/section";
import { PackageCard } from "@/components/scl/package-card";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import {
  getCapperProfileIdForUser,
  getOwnerLivePackagesForCapper,
  getOwnerWhopPackagesForCapper,
  listConnectionsForCapper,
} from "@/lib/queries/store";
import { getStorefrontMessagesForCapper } from "@/lib/queries/storefront-messages";
import { refreshWhopStorefrontIfStale } from "@/lib/whop-sync";

export const metadata = { title: "Storefront" };

type Search = {
  searchParams: Promise<{ thread?: string }>;
};

export default async function MonetizationPage({ searchParams }: Search) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;

  const capperId = await getCapperProfileIdForUser(user.id);
  if (capperId) {
    await refreshWhopStorefrontIfStale({ capperId });
  }
  const capperAccount = capperId
    ? await prisma.user.findUnique({
        where: { id: user.id },
        select: { username: true },
      })
    : null;
  const [connections, livePackages, ownerWhopPackages] = capperId
    ? await Promise.all([
        listConnectionsForCapper(capperId),
        getOwnerLivePackagesForCapper(capperId),
        getOwnerWhopPackagesForCapper(capperId),
      ])
    : [[], [], []];

  const connectionIds = connections.map((connection) => connection.id);
  const messagesByConnection = capperId
    ? await getStorefrontMessagesForCapper(capperId, connectionIds)
    : {};

  const serializedMessages = Object.fromEntries(
    Object.entries(messagesByConnection).map(([id, rows]) => [
      id,
      rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
    ]),
  );

  const carriedOver = connections.length ? [] : livePackages;
  const hasCarriedStorefront = carriedOver.length > 0;
  const editableWhopIds = new Set(ownerWhopPackages.map((pkg) => pkg.id));
  const readOnlyPackages = livePackages.filter(
    (pkg) => !editableWhopIds.has(pkg.id),
  );

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
        messagesByConnection={serializedMessages}
        activeThreadId={sp.thread ?? null}
        capperUsername={capperAccount?.username ?? null}
      />

      {ownerWhopPackages.length ? (
        <section className="space-y-3">
          <div>
            <h2 className="scl-display text-sm font-bold tracking-[0.08em] uppercase">
              Your Whop packages
            </h2>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Names, descriptions, and visibility sync both ways. Whop remains
              the source of truth for price and billing.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {ownerWhopPackages.map((pkg) => (
              <CapperWhopPackageEditor key={pkg.id} pkg={pkg} />
            ))}
          </div>
        </section>
      ) : null}

      {readOnlyPackages.length ? (
        <section className="space-y-3">
          <h2 className="scl-display text-sm font-bold tracking-[0.08em] uppercase">
            Other live packages (read-only)
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {readOnlyPackages.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
