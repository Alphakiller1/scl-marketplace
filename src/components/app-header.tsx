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
            <span className="from-brand/20 to-primary/20 ring-border-strong flex size-8 items-center justify-center rounded-xl bg-gradient-to-br ring-1">
              <SclLogo className="size-5" />
            </span>
            <span className="scl-brand-text font-extrabold tracking-tight">
              SCL
            </span>
            <span className="bg-surface-3 text-muted-foreground max-w-20 truncate rounded-md px-1.5 py-0.5 text-[0.7rem] font-semibold tracking-wide uppercase">
              {area}
            </span>
          </Link>
          <nav className="text-muted-foreground hidden items-center gap-5 text-sm sm:flex">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="hover:text-foreground transition-colors"
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
