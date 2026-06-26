import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { SclLogo } from "@/components/scl/scl-logo";

export function AppHeader({
  area,
  nav,
}: {
  area: string;
  nav: { href: string; label: string }[];
}) {
  return (
    <header className="border-border bg-background/80 sticky top-0 z-40 w-full border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" aria-label="SCL home">
            <SclLogo area={area} />
          </Link>
          <nav className="text-muted-foreground hidden items-center gap-5 text-sm sm:flex">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="hover:text-foreground transition-colors"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
