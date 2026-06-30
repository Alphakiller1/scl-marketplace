import { requireCapperAccess } from "@/lib/session";
import { AppHeader } from "@/components/app-header";

const CAPPER_NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/picks", label: "My Picks" },
  { href: "/dashboard/profile", label: "Profile" },
];

export default async function CapperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense in depth (middleware already gates /dashboard).
  await requireCapperAccess();

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader area="Capper" nav={CAPPER_NAV} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
