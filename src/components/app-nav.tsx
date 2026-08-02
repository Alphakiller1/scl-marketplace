"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * App-workspace primary nav (Capper / Admin) with an active-page indicator so a
 * user always knows which section they're on (blue = navigation, aria-current +
 * a persistent underline). Longest-prefix match: the deepest owning route wins,
 * so /dashboard/picks/new lights the New Pick CTA — not My Picks — and
 * /dashboard stays active only on the dashboard itself.
 */
export function AppNav({ nav }: { nav: { href: string; label: string }[] }) {
  const pathname = usePathname();

  const activeHref = nav.reduce<string | null>((best, n) => {
    const match = pathname === n.href || pathname.startsWith(`${n.href}/`);
    if (!match) return best;
    return !best || n.href.length > best.length ? n.href : best;
  }, null);

  return (
    <nav
      className="hidden items-center gap-1 text-sm sm:flex"
      aria-label="Primary"
    >
      {nav.map((n) => {
        const primary = n.href.includes("/picks/new");
        if (primary) {
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={(event) => {
                if (pathname !== n.href) return;
                // A receipt is client state on this same route. A normal
                // same-URL Next navigation preserves it, so deliberately
                // start a fresh entry session when New Pick is clicked again.
                event.preventDefault();
                window.location.assign(n.href);
              }}
              className="scl-cta-brand inline-flex h-9 items-center px-3.5"
            >
              {n.label}
            </Link>
          );
        }
        const active = n.href === activeHref;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-10 items-center border-b-2 px-3 transition-colors",
              active
                ? "border-[color:var(--scl-blue)] font-semibold text-[color:var(--scl-text)]"
                : "border-transparent text-[color:var(--scl-muted-data)] hover:text-[color:var(--scl-text)]",
            )}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
