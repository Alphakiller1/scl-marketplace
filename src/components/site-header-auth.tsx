"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { MobileSiteNav } from "@/components/scl/mobile-navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { getDefaultWorkspace } from "@/lib/auth-routing";
import { useSessionUser } from "@/lib/use-session-user";

/**
 * Header auth chrome, resolved in the browser.
 *
 * This used to be a server component awaiting `auth()`. It was inside a
 * `<Suspense>` boundary, which is enough to stream it — but NOT enough to keep
 * the route static: without Partial Prerendering, one dynamic API anywhere in
 * the tree opts the whole route into dynamic rendering. Because this header
 * lives in the `(marketing)` layout, that single `auth()` call forced EVERY
 * public page (home, leaderboard, discover, packages, capper profiles) to
 * re-render and re-query the database on every request, so their
 * `export const revalidate = 60` never took effect.
 *
 * Reading the session client-side takes the dynamic API out of the render path,
 * so those pages prerender and serve from the CDN. The signed-out buttons below
 * are exactly what the old Suspense fallback rendered, so the first paint is
 * unchanged; a signed-in visitor sees it swap once the session resolves.
 */
export function SiteHeaderAuth() {
  const user = useSessionUser();

  if (!user) return <SignedOutChrome />;

  const workspace = getDefaultWorkspace(user.role ?? null);
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

function SignedOutChrome() {
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
