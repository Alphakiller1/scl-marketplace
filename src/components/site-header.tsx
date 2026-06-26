import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SclLogo } from "@/components/scl/scl-logo";

export function SiteHeader() {
  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-40 w-full border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="SCL home">
          <SclLogo className="text-lg" />
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
