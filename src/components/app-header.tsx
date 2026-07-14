import Link from "next/link";

import { SclLogo } from "@/components/scl-logo";
import { MobileAppNav } from "@/components/scl/mobile-navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/sign-out-button";

export function AppHeader({
  area,
  nav,
}: {
  area: string;
  nav: { href: string; label: string }[];
}) {
  return (
    <header className="border-border bg-background/80 sticky top-0 z-40 w-full border-b pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-6">
          <Link
            href="/"
            className="flex min-h-11 min-w-0 items-center gap-2 font-semibold"
          >
            <span className="ring-border-strong flex size-8 items-center justify-center rounded-xl bg-[color:var(--scl-ink-800)] ring-1">
              <SclLogo className="size-5" />
            </span>
            <span className="scl-display font-bold tracking-[0.08em] uppercase">
              SCL
            </span>
            <span className="bg-surface-3 text-muted-foreground max-w-20 truncate rounded-md px-1.5 py-0.5 text-[0.7rem] font-semibold tracking-wide uppercase">
              {area}
            </span>
          </Link>
          <nav className="text-muted-foreground hidden items-center gap-1 text-sm sm:flex">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="hover:text-foreground inline-flex min-h-11 items-center px-3 transition-colors"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <div className="hidden sm:block">
            <SignOutButton />
          </div>
          <MobileAppNav area={area} nav={nav} />
        </div>
      </div>
    </header>
  );
}
