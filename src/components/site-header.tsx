import Link from "next/link";
import { TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <TrendingUp className="size-5" />
          </span>
          <span className="text-lg tracking-tight">SCL</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
          <Link href="/leaderboard" className="transition-colors hover:text-foreground">
            Leaderboard
          </Link>
          <Link href="/cappers" className="transition-colors hover:text-foreground">
            Cappers
          </Link>
          <Link href="/packages" className="transition-colors hover:text-foreground">
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
