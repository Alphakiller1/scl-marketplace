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
    <header className="border-border bg-sidebar sticky top-0 z-40 w-full border-b pt-[env(safe-area-inset-top)]">
      <div className="mx-auto grid h-16 w-full max-w-[1400px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="col-start-1 row-start-1 flex min-h-11 min-w-0 items-center gap-2.5 justify-self-start font-semibold"
        >
          <span className="ring-border-strong flex size-9 items-center justify-center rounded-xl bg-[color:var(--scl-ink-800)] ring-1">
            <SclLogo className="size-6" />
          </span>
          <span className="scl-display text-lg font-bold tracking-[0.08em] uppercase">
            SCL
          </span>
        </Link>

        <nav className="text-muted-foreground col-start-2 row-start-1 hidden items-center gap-2 justify-self-center text-sm sm:flex">
          <Link
            href="/picks"
            className="inline-flex min-h-11 items-center px-3 text-[color:var(--scl-text)] underline-offset-4 transition-colors hover:underline hover:decoration-[color:var(--scl-blue)]"
          >
            Picks
          </Link>
          <Link
            href="/leaderboard"
            className="inline-flex min-h-11 items-center px-3 text-[color:var(--scl-text)] underline-offset-4 transition-colors hover:underline hover:decoration-[color:var(--scl-blue)]"
          >
            Leaderboard
          </Link>
          <Link
            href="/discover"
            className="inline-flex min-h-11 items-center px-3 text-[color:var(--scl-text)] underline-offset-4 transition-colors hover:underline hover:decoration-[color:var(--scl-blue)]"
          >
            Discover
          </Link>
        </nav>

        <div className="col-start-3 row-start-1 flex shrink-0 items-center gap-1 justify-self-end sm:gap-2">
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
                className="hidden min-h-11 border-[color:var(--scl-pink)] bg-[color:var(--scl-pink)] text-[color:var(--scl-pink-ink)] hover:bg-[color:var(--scl-pink-deep)] hover:text-[color:var(--scl-pink-ink)] sm:inline-flex md:h-11"
              >
                Join SCL
              </Button>
            </>
          )}
          <MobileSiteNav authed={authed} />
        </div>
      </div>
    </header>
  );
}
