import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-border border-t">
      <div className="text-muted-foreground mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-10 text-sm leading-relaxed sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>© {new Date().getFullYear()} Sports Capper Leaderboard</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-1">
          <Link
            href="/#how-verification-works"
            className="hover:text-foreground inline-flex min-h-10 items-center"
          >
            How Verification Works
          </Link>
          <Link
            href="/terms"
            className="hover:text-foreground inline-flex min-h-10 items-center"
          >
            Terms
          </Link>
          <Link
            href="/privacy"
            className="hover:text-foreground inline-flex min-h-10 items-center"
          >
            Privacy
          </Link>
          <Link
            href="/responsible-gaming"
            className="hover:text-foreground inline-flex min-h-10 items-center"
          >
            Responsible Gaming
          </Link>
          <Link
            href="/disclaimer"
            className="hover:text-foreground inline-flex min-h-10 items-center"
          >
            Disclaimer
          </Link>
        </nav>
      </div>
    </footer>
  );
}
