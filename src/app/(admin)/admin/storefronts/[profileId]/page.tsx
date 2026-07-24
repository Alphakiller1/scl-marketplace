import Link from "next/link";
import { notFound } from "next/navigation";
import { Store } from "lucide-react";

import { PackageAdminPanel } from "@/components/scl/package-admin-panel";
import { SectionHeader } from "@/components/scl/section";
import { StorefrontAdminControl } from "@/components/scl/storefront-admin-control";
import { StorefrontStatusBadge } from "@/components/scl/storefront-status-badge";
import { COMMERCE_PLATFORM_LABEL } from "@/lib/commerce";
import { getAdminStorefrontDetail } from "@/lib/queries/admin-storefronts";

export const metadata = { title: "Storefront detail" };

type PageProps = { params: Promise<{ profileId: string }> };

export default async function AdminStorefrontDetailPage({ params }: PageProps) {
  const { profileId } = await params;
  const detail = await getAdminStorefrontDetail(profileId);
  if (!detail) notFound();

  const handle = detail.user.username
    ? `@${detail.user.username.replace(/^@/, "")}`
    : detail.user.email;
  const reviewer = detail.lastReviewedBy?.username
    ? `@${detail.lastReviewedBy.username.replace(/^@/, "")}`
    : detail.lastReviewedBy?.displayName;

  return (
    <div className="space-y-8">
      <SectionHeader
        icon={Store}
        title={handle}
        subtitle="Manage affiliate platform status, internal notes, and approved package links"
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="border-border bg-card space-y-4 rounded-xl border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StorefrontStatusBadge status={detail.storefrontStatus} />
            <span className="text-muted-foreground text-sm">
              {COMMERCE_PLATFORM_LABEL[detail.commercePlatform]}
            </span>
          </div>
          <StorefrontAdminControl
            capperProfileId={detail.id}
            commercePlatform={detail.commercePlatform}
            storefrontStatus={detail.storefrontStatus}
            adminNotes={detail.adminNotes}
          />
          <p className="text-muted-foreground text-xs">
            Last reviewed{" "}
            {detail.lastReviewedAt
              ? detail.lastReviewedAt.toLocaleString()
              : "never"}
            {reviewer ? ` by ${reviewer}` : ""}
          </p>
        </section>

        <aside className="border-border bg-surface-2 rounded-xl border p-4 text-sm">
          <h3 className="font-semibold">Workflow</h3>
          <ol className="text-muted-foreground mt-3 list-decimal space-y-2 pl-4">
            <li>Capper submits affiliate request.</li>
            <li>SCL accepts on Winible or Whop.</li>
            <li>Admin enters approved package links here.</li>
            <li>Set visibility to Live when checkout is verified.</li>
          </ol>
          {detail.user.username ? (
            <Link
              href={`/cappers/${detail.user.username}`}
              className="text-brand mt-4 inline-block text-sm font-medium"
            >
              View public profile
            </Link>
          ) : null}
        </aside>
      </div>

      <section className="space-y-4">
        <SectionHeader
          icon={Store}
          title="Packages"
          subtitle="Name, price, checkout link, trial terms, visibility, and display order"
        />
        <PackageAdminPanel
          capperProfileId={detail.id}
          packages={detail.packages}
        />
      </section>
    </div>
  );
}
