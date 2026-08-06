import { Suspense } from "react";
import { connection } from "next/server";

import { requireAdmin } from "@/lib/session";
import { AppHeader } from "@/components/app-header";
import { AdminRouteSkeleton } from "@/components/scl/admin-route-skeleton";
import { countStorefrontQueue } from "@/lib/queries/store";
import { countUnreadStorefrontMessagesForAdmin } from "@/lib/queries/storefront-messages";

const ADMIN_NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/plays", label: "Published Plays" },
  { href: "/admin/grading", label: "Grading" },
  { href: "/admin/cappers", label: "Cappers" },
  { href: "/admin/store-setup", label: "Storefronts & Packages" },
  { href: "/admin/policies", label: "Policies" },
];

async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Admin data and authorization are request-specific; never prerender these routes.
  await connection();

  // Storefront submissions awaiting SCL — surfaced in the nav so a capper who
  // completed their affiliate steps is impossible to miss. Soft-fails to 0.
  const [storeQueue, unreadMessages] = await Promise.all([
    countStorefrontQueue(),
    countUnreadStorefrontMessagesForAdmin(),
  ]);
  const storeAttention = storeQueue + unreadMessages;
  const nav = ADMIN_NAV.map((item) =>
    item.href === "/admin/store-setup" && storeAttention > 0
      ? { ...item, label: `Store Setup (${storeAttention})` }
      : item,
  );

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader area="Admin" nav={nav} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Suspense fallback={<AdminRouteSkeleton />}>
          <AdminGate>{children}</AdminGate>
        </Suspense>
      </main>
    </div>
  );
}
