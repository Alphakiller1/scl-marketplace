import { Suspense } from "react";

import { requireCapperAccess } from "@/lib/session";
import { AppHeader } from "@/components/app-header";
import { CapperRouteSkeleton } from "@/components/scl/capper-route-skeleton";
import { NewPickFab } from "@/components/scl/new-pick-fab";
import { PasswordUpdateNotice } from "@/components/scl/password-update-notice";

const CAPPER_NAV = [
  { href: "/dashboard/picks/new", label: "New Pick" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/picks", label: "My Picks" },
  { href: "/dashboard/monetization", label: "Storefront" },
  { href: "/dashboard/profile", label: "Profile" },
  // /dashboard/security is deliberately not here — a sixth label overflows the
  // desktop nav at `sm`. It's reached from the profile page, the password
  // prompt below, and the emailed notice.
];

/**
 * Auth gate as a Suspense child so chrome paints immediately on nav clicks.
 * Middleware still blocks anonymous access; this is defense-in-depth.
 */
async function CapperGate({ children }: { children: React.ReactNode }) {
  const account = await requireCapperAccess();
  return (
    <>
      {account.passwordUpdateRequiredAt ? <PasswordUpdateNotice /> : null}
      {children}
    </>
  );
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
