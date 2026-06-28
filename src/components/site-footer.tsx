import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-border border-t">
      <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© {new Date().getFullYear()} Sports Capper Leaderboard</p>
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
