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
    <header className="border-border/60 bg-background/80 sticky top-0 z-40 w-full border-b pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="flex min-h-11 min-w-0 items-center gap-2.5 font-semibold"
        >
          <span className="from-brand/20 to-primary/20 ring-border-strong flex size-9 items-center justify-center rounded-xl bg-gradient-to-br ring-1">
            <SclLogo className="size-6" />
          </span>
          <span className="scl-brand-text text-lg font-extrabold tracking-tight">
            SCL
          </span>
        </Link>

        <nav className="text-muted-foreground hidden items-center gap-6 text-sm sm:flex">
          <Link
            href="/leaderboard"
            className="hover:text-foreground transition-colors"
          >
            Leaderboard
          </Link>
          <Link
            href="/cappers"
            className="hover:text-foreground transition-colors"
          >
            Cappers
          </Link>
          <Link
            href="/packages"
            className="hover:text-foreground transition-colors"
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
                className="hidden sm:inline-flex"
              >
                Dashboard
              </Button>
              <SignOutButton className="hidden sm:inline-flex" />
            </>
          ) : (
            <>
              <Button
                render={<Link href="/login" />}
                nativeButton={false}
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex"
              >
                Log In
              </Button>
              <Button
                render={<Link href="/signup" />}
                nativeButton={false}
                size="sm"
                className="hidden sm:inline-flex"
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
