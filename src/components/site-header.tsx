import Link from "next/link";

import { SclLogo } from "@/components/scl-logo";
import { SiteHeaderAuth } from "@/components/site-header-auth";
import { SiteNav } from "@/components/scl/site-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { SCL_BRAND_NAME } from "@/lib/brand";

/**
 * Marketing chrome.
 *
 * Deliberately contains NO dynamic API. This header is rendered by the
 * `(marketing)` layout, so anything dynamic here — `auth()`, `cookies()`,
 * `headers()` — opts every public page into dynamic rendering, even inside a
 * `<Suspense>` boundary. That is what was defeating `export const revalidate`
 * on home, leaderboard, discover, packages and capper profiles. Session state
 * now resolves in the browser; see `site-header-auth.tsx`.
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
          <span className="scl-display max-w-[9.5rem] text-xs leading-tight font-bold tracking-[0.02em] sm:max-w-none sm:text-sm lg:text-base">
            {SCL_BRAND_NAME}
          </span>
        </Link>

        <SiteNav />

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <SiteHeaderAuth />
        </div>
      </div>
    </header>
  );
}
