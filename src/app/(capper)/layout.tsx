import { Suspense } from "react";

import { requireCapperAccess } from "@/lib/session";
import { AppHeader } from "@/components/app-header";
import { CapperRouteSkeleton } from "@/components/scl/capper-route-skeleton";
import { NewPickFab } from "@/components/scl/new-pick-fab";

const CAPPER_NAV = [
  { href: "/dashboard/picks/new", label: "New Pick" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/picks", label: "My Picks" },
  { href: "/dashboard/monetization", label: "Storefront" },
  { href: "/dashboard/profile", label: "Profile" },
];

/**
 * Auth gate as a Suspense child so chrome paints immediately on nav clicks.
 * Middleware still blocks anonymous access; this is defense-in-depth.
 */
async function CapperGate({ children }: { children: React.ReactNode }) {
  await requireCapperAccess();
  return children;
}

export default function CapperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader area="Capper" nav={CAPPER_NAV} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 sm:px-6 sm:py-8 sm:pb-8">
        <Suspense fallback={<CapperRouteSkeleton />}>
          <CapperGate>{children}</CapperGate>
        </Suspense>
      </main>
      <NewPickFab />
    </div>
  );
}
