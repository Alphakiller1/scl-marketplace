import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { SclLogo } from "@/components/scl-logo";
import { MobileAppNav } from "@/components/scl/mobile-navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { SCL_BRAND_NAME } from "@/lib/brand";

export function AppHeader({
  area,
  nav,
}: {
  area: string;
  nav: { href: string; label: string }[];
}) {
  return (
    <header className="border-border bg-sidebar sticky top-0 z-40 w-full border-b pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-6">
          <Link
            href="/"
            className="flex min-h-10 min-w-0 items-center gap-2 font-semibold"
          >
            <span className="ring-border-strong flex size-8 items-center justify-center rounded-xl bg-[color:var(--scl-ink-800)] ring-1">
              <SclLogo className="size-5" />
            </span>
            <span className="scl-display max-w-[8.75rem] text-[0.7rem] leading-tight font-bold tracking-[0.02em] sm:max-w-none sm:text-sm">
              {SCL_BRAND_NAME}
            </span>
            <span className="bg-surface-3 text-muted-foreground hidden max-w-20 truncate rounded-md px-1.5 py-0.5 text-[0.7rem] font-semibold tracking-wide uppercase md:inline-flex">
              {area}
            </span>
          </Link>
          <AppNav nav={nav} />
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
