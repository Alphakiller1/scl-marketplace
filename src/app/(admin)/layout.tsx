import { requireAdmin } from "@/lib/session";
import { AppHeader } from "@/components/app-header";

const ADMIN_NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/grading", label: "Grading" },
  { href: "/admin/cappers", label: "Cappers" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense in depth (middleware already gates /admin to ADMIN role).
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
