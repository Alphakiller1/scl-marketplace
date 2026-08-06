"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";

/**
 * Routes that own their primary action.
 *
 * The FAB is fixed at z-40 and these pages put their own submit in a sticky
 * bottom bar at z-10, so it painted straight over "Save Public Profile" and
 * over whatever content sat behind it. Two competing primary actions in the
 * same corner is the bug; the page's own action wins.
 */
const OWN_PRIMARY_ACTION = ["/dashboard/picks/new", "/dashboard/profile"];

/**
 * Sticky mobile primary action for cappers — always one tap from New Pick
 * while scrolling the workspace. Stands down where the page has its own.
 */
export function NewPickFab() {
  const pathname = usePathname();
  if (OWN_PRIMARY_ACTION.some((route) => pathname?.startsWith(route))) {
    return null;
  }

  return (
    <Link
      href="/dashboard/picks/new"
      className="scl-cta-brand focus-visible:ring-ring fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 inline-flex min-h-12 items-center gap-2 px-5 focus-visible:ring-2 focus-visible:outline-none sm:hidden"
      aria-label="New Pick"
    >
      <Plus className="size-4" aria-hidden />
      New Pick
    </Link>
  );
}
