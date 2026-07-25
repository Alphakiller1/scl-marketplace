import { requireAdmin } from "@/lib/session";
import { AppHeader } from "@/components/app-header";

const ADMIN_NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/plays", label: "Plays" },
  { href: "/admin/grading", label: "Grading" },
  { href: "/admin/cappers", label: "Cappers" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/storefronts", label: "Storefronts" },
  { href: "/admin/store", label: "Store" },
  { href: "/admin/sales", label: "Sales" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/policies", label: "Policies" },
  { href: "/admin/communications", label: "Comms" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense in depth: `src/proxy.ts` (Next 16's middleware) already gates /admin
  // to ADMIN role, but it reads the role off the JWT at the edge. This check
  // hits the DB, so a demoted admin loses access without waiting for expiry.
  await requireAdmin();

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader area="Admin" nav={ADMIN_NAV} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
