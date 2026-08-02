import Link from "next/link";
import { Suspense } from "react";

import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { SclLogo } from "@/components/scl-logo";
import { MobileSiteNav } from "@/components/scl/mobile-navigation";
import { SiteNav } from "@/components/scl/site-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { getDefaultWorkspace } from "@/lib/auth-routing";
import { SCL_BRAND_NAME } from "@/lib/brand";

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
          className="flex min-h-10 min-w-0 items-center gap-2.5 font-semibold"
        >
          <span className="ring-border-strong flex size-9 items-center justify-center rounded-xl bg-[color:var(--scl-ink-800)] ring-1">
            <SclLogo className="size-6" />
          </span>
          <span className="scl-display max-w-[9.5rem] text-[0.7rem] leading-tight font-bold tracking-[0.02em] sm:max-w-none sm:text-sm lg:text-base">
            {SCL_BRAND_NAME}
          </span>
        </Link>

        <SiteNav />

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
      <MobileSiteNav />
    </>
  );
}

async function SiteHeaderAuth() {
  const session = await auth();
  const user = session?.user;

  if (user) {
    const workspace = getDefaultWorkspace(user.role);
    return (
      <>
        <Button
          render={<Link href={workspace.href} />}
          nativeButton={false}
          variant="nav"
          size="sm"
          className="hidden min-h-10 sm:inline-flex"
        >
          {workspace.label}
        </Button>
        <SignOutButton className="hidden min-h-10 sm:inline-flex" />
        <MobileSiteNav workspace={workspace} />
      </>
    );
  }

  return <SiteHeaderAuthFallback />;
}
