import Link from "next/link";

import { SclLogo } from "@/components/scl-logo";

export function SiteFooter() {
  return (
    <footer className="border-border border-t">
      <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2.5">
          <SclLogo className="size-6" />
          <p>
            <Link
              href="/"
              className="scl-brand-text font-extrabold tracking-tight"
            >
              SCL
            </Link>{" "}
            <span className="text-muted-foreground">
              · © {new Date().getFullYear()} Sports Capper League
            </span>
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/responsible-gaming" className="hover:text-foreground">
            Responsible Gaming
          </Link>
          <Link href="/disclaimer" className="hover:text-foreground">
            Disclaimer
          </Link>
        </nav>
      </div>
    </footer>
  );
}
