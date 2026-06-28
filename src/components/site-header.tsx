import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SclLogo } from "@/components/scl-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-40 w-full border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-semibold">
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

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            render={<Link href="/login" />}
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
          >
            Log in
          </Button>
          <Button render={<Link href="/signup" />} size="sm">
            Become a capper
          </Button>
        </div>
      </div>
    </header>
  );
}
