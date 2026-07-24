import { Suspense } from "react";

import { requireAdmin } from "@/lib/session";
import { AppHeader } from "@/components/app-header";
import { AdminRouteSkeleton } from "@/components/scl/admin-route-skeleton";

const ADMIN_NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/grading", label: "Grading" },
  { href: "/admin/cappers", label: "Cappers" },
  { href: "/admin/store-setup", label: "Store Setup" },
];

async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader area="Admin" nav={ADMIN_NAV} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Suspense fallback={<AdminRouteSkeleton />}>
          <AdminGate>{children}</AdminGate>
        </Suspense>
      </main>
    </div>
  );
}
