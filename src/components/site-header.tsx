import Link from "next/link";
import { Suspense } from "react";

import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { SclLogo } from "@/components/scl-logo";
import { MobileSiteNav } from "@/components/scl/mobile-navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Marketing chrome. Auth is a Suspense island so public nav links paint
 * immediately and do not wait on the session round-trip every click.
 */
export function SiteHeader() {
  return (
    <header className="border-border bg-sidebar sticky top-0 z-40 w-full border-b pt-[env(safe-area-inset-top)]">
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
            href="/picks"
            prefetch
            className="inline-flex min-h-11 items-center px-3 text-[color:var(--scl-text)] underline-offset-4 transition-colors hover:underline hover:decoration-[color:var(--scl-blue)]"
          >
            Picks
          </Link>
          <Link
            href="/leaderboard"
            prefetch
            className="inline-flex min-h-11 items-center px-3 text-[color:var(--scl-text)] underline-offset-4 transition-colors hover:underline hover:decoration-[color:var(--scl-blue)]"
          >
            Leaderboard
          </Link>
          <Link
            href="/discover"
            prefetch
            className="inline-flex min-h-11 items-center px-3 text-[color:var(--scl-text)] underline-offset-4 transition-colors hover:underline hover:decoration-[color:var(--scl-blue)]"
          >
            Discover
          </Link>
          <Link
            href="/packages"
            prefetch
            className="inline-flex min-h-11 items-center px-3 text-[color:var(--scl-text)] underline-offset-4 transition-colors hover:underline hover:decoration-[color:var(--scl-blue)]"
          >
            Packages
          </Link>
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Suspense fallback={<SiteHeaderAuthFallback />}>
            <SiteHeaderAuth />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

function SiteHeaderAuthFallback() {
  return (
    <>
      <Button
        render={<Link href="/login" />}
        nativeButton={false}
        variant="ghost"
        size="sm"
        className="hidden min-h-10 sm:inline-flex"
      >
        Log In
      </Button>
      <Button
        render={<Link href="/signup" />}
        nativeButton={false}
        variant="brand"
        size="sm"
        className="hidden min-h-10 sm:inline-flex"
      >
        Join SCL
      </Button>
      <MobileSiteNav authed={false} />
    </>
  );
}

async function SiteHeaderAuth() {
  const session = await auth();
  const authed = Boolean(session?.user);

  if (authed) {
    return (
      <>
        <Button
          render={<Link href="/dashboard" />}
          nativeButton={false}
          variant="nav"
          size="sm"
          className="hidden min-h-10 sm:inline-flex"
        >
          Dashboard
        </Button>
        <SignOutButton className="hidden min-h-10 sm:inline-flex" />
        <MobileSiteNav authed />
      </>
    );
  }

  return <SiteHeaderAuthFallback />;
}
