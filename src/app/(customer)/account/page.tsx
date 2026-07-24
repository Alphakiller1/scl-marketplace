import Link from "next/link";
import { ShoppingBag } from "lucide-react";

import { AccountStatusBadge } from "@/components/scl/account-trust";
import { SectionHeader } from "@/components/scl/section";
import { requireCustomerAccess } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "My account" };

export default async function CustomerAccountPage() {
  const account = await requireCustomerAccess();
  const profile = await prisma.customerProfile.findUnique({
    where: { userId: account.id },
    select: {
      marketingOptIn: true,
      purchases: {
        orderBy: { purchasedAt: "desc" },
        take: 8,
        select: {
          purchasedAt: true,
          grossCents: true,
          status: true,
          package: { select: { title: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-8">
      <SectionHeader
        icon={ShoppingBag}
        title="Customer Account"
        subtitle="Your SCL marketplace profile and purchase history"
      />

      <div className="border-border bg-card space-y-3 rounded-xl border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">
            {account.displayName || account.email}
          </h2>
          <AccountStatusBadge status={account.accountStatus} />
        </div>
        <p className="text-muted-foreground text-sm">{account.email}</p>
        <p className="text-muted-foreground text-sm">
          Marketing emails: {profile?.marketingOptIn ? "Opted in" : "Opted out"}
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase">Purchase history</h2>
        {profile?.purchases.length ? (
          <div className="border-border divide-border divide-y overflow-hidden rounded-xl border">
            {profile.purchases.map((purchase) => (
              <article
                key={`${purchase.package.title}-${purchase.purchasedAt.toISOString()}`}
                className="bg-card p-4 text-sm"
              >
                <p className="font-semibold">{purchase.package.title}</p>
                <p className="text-muted-foreground mt-1">
                  {purchase.purchasedAt.toLocaleDateString()} · $
                  {(purchase.grossCents / 100).toFixed(2)} · {purchase.status}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No linked purchases yet. When you buy through an SCL package link
            while signed in, purchases can be attributed here.
          </p>
        )}
      </section>

      <p className="text-muted-foreground text-sm">
        Browse capper packages on{" "}
        <Link href="/packages" className="text-brand font-medium">
          the marketplace
        </Link>
        .
      </p>
    </div>
  );
}
