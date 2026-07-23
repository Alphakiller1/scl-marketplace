import { requireCapperAccess } from "@/lib/session";
import { AppHeader } from "@/components/app-header";
import { NewPickFab } from "@/components/scl/new-pick-fab";

const CAPPER_NAV = [
  { href: "/dashboard/picks/new", label: "New Pick" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/picks", label: "My Picks" },
  { href: "/dashboard/monetization", label: "Storefront" },
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
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 sm:px-6 sm:py-8 sm:pb-8">
        {children}
      </main>
      <NewPickFab />
    </div>
  );
}
