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
      className="focus-visible:ring-ring fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 inline-flex min-h-12 items-center gap-2 rounded-full border-[color:var(--scl-pink)] bg-[color:var(--scl-pink)] px-5 text-sm font-semibold text-[color:var(--scl-pink-ink)] shadow-[0_12px_32px_rgba(0,0,0,0.35)] focus-visible:ring-2 focus-visible:outline-none sm:hidden"
      aria-label="New Pick"
    >
      <Plus className="size-4" aria-hidden />
      New Pick
    </Link>
  );
}
