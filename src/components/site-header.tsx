import Link from "next/link";

import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { SclLogo } from "@/components/scl-logo";
import { MobileSiteNav } from "@/components/scl/mobile-navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";

export async function SiteHeader() {
  const session = await auth();
  const authed = Boolean(session?.user);

  return (
    <header className="border-border bg-[color:var(--scl-ink-900)] sticky top-0 z-40 w-full border-b pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="flex min-h-11 min-w-0 items-center gap-2.5 font-semibold"
        >
          <span className="ring-border-strong flex size-9 items-center justify-center rounded-xl bg-[color:var(--scl-ink-800)] ring-1">
            <SclLogo className="size-6" />
          </span>
          <span className="scl-display text-lg font-bold tracking-[0.08em] uppercase">
            SCL
          </span>
        </Link>

        <nav className="text-muted-foreground hidden items-center gap-1 text-sm sm:flex">
          <Link
            href="/leaderboard"
            className="hover:text-foreground inline-flex min-h-11 items-center px-3 transition-colors"
          >
            Leaderboard
          </Link>
          <Link
            href="/cappers"
            className="hover:text-foreground inline-flex min-h-11 items-center px-3 transition-colors"
          >
            Cappers
          </Link>
          <Link
            href="/packages"
            className="hover:text-foreground inline-flex min-h-11 items-center px-3 transition-colors"
          >
            Packages
          </Link>
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {authed ? (
            <>
              <Button
                render={<Link href="/dashboard" />}
                nativeButton={false}
                size="sm"
                className="hidden min-h-11 sm:inline-flex md:h-11"
              >
                Dashboard
              </Button>
              <SignOutButton className="hidden min-h-11 sm:inline-flex md:h-11" />
            </>
          ) : (
            <>
              <Button
                render={<Link href="/login" />}
                nativeButton={false}
                variant="ghost"
                size="sm"
                className="hidden min-h-11 sm:inline-flex md:h-11"
              >
                Log In
              </Button>
              <Button
                render={<Link href="/signup" />}
                nativeButton={false}
                size="sm"
                className="hidden min-h-11 border-[color:var(--scl-gold)] bg-[color:var(--scl-gold)] text-[color:var(--scl-gold-ink)] hover:bg-[color:var(--scl-gold-deep)] hover:text-[color:var(--scl-gold-ink)] sm:inline-flex md:h-11"
              >
                Become A Capper
              </Button>
            </>
          )}
          <MobileSiteNav authed={authed} />
        </div>
      </div>
    </header>
  );
}
