"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";

/**
 * Sticky mobile primary action for cappers — always one tap from New Pick
 * while scrolling the workspace. Hidden on the entry form itself.
 */
export function NewPickFab() {
  const pathname = usePathname();
  if (pathname?.startsWith("/dashboard/picks/new")) return null;

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
