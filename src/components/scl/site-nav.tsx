"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/picks", label: "Picks" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/discover", label: "Discover" },
  { href: "/packages", label: "Packages" },
] as const;

/**
 * Marketing primary nav with an active-page indicator (blue = navigation).
 * The current section reads via aria-current + a persistent underline so a
 * user always knows which page they're on.
 */
export function SiteNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "text-muted-foreground hidden items-center gap-1 text-sm sm:flex",
        className,
      )}
      aria-label="Primary"
    >
      {LINKS.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            prefetch
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center border-b-2 px-3 transition-colors",
              active
                ? "border-[color:var(--scl-blue)] font-semibold text-[color:var(--scl-text)]"
                : "border-transparent text-[color:var(--scl-muted-data)] hover:text-[color:var(--scl-text)]",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
