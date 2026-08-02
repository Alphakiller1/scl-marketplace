import Link from "next/link";
import { Clock3, ShieldCheck } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { SclLogo } from "@/components/scl-logo";

const trustSignals = [
  { icon: Clock3, label: "Picks", value: "Entered Before Lock" },
  { icon: ShieldCheck, label: "Records", value: "Independently Verified" },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[color:var(--scl-ink-950)]">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto w-full max-w-5xl px-4 pt-4 sm:px-8 lg:px-10 lg:pt-12">
        <Link
          href="/"
          aria-label="SCL Home"
          className="pointer-events-auto inline-flex min-h-10 items-center"
        >
          <BrandLockup />
        </Link>
      </div>

      <div className="relative mx-auto grid min-h-screen w-full max-w-5xl lg:grid-cols-[minmax(0,1fr)_27rem]">
        <aside className="border-border hidden border-r px-10 py-12 lg:flex lg:flex-col lg:justify-between">
          <div className="h-9" aria-hidden />

          <div className="max-w-md">
            <p className="scl-eyebrow text-[color:var(--scl-muted-label)]">
              Sports Cappers Leaderboard
            </p>
            <p className="scl-display mt-3 text-4xl leading-[1.08] font-bold tracking-[0.02em]">
              Trust starts with a verified record
            </p>
            <p className="text-muted-foreground mt-4 max-w-sm">
              Sign in to track your picks and climb the leaderboard. Top
              performing cappers earn marketing exposure. Integrate your
              storefront to optimize sales.
            </p>
          </div>

          <dl className="grid gap-2">
            {trustSignals.map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="border-border bg-card/60 flex items-center gap-3 rounded-xl border px-3 py-2.5"
              >
                <Icon
                  className="size-4 text-[color:var(--scl-muted-data)]"
                  aria-hidden
                />
                <dt className="text-muted-foreground text-sm">{label}</dt>
                <dd className="ml-auto text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </aside>

        <main className="flex min-h-screen items-start px-4 pt-24 pb-8 sm:px-8 lg:items-center lg:px-10 lg:py-16">
          <div className="mx-auto w-full max-w-md">
            <div className="border-border bg-card rounded-xl border p-4 shadow-sm sm:p-7">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function BrandLockup() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="ring-border-strong flex size-9 items-center justify-center rounded-xl bg-[color:var(--scl-ink-800)] ring-1">
        <SclLogo className="size-6" />
      </span>
      <span className="scl-display text-sm font-bold tracking-[0.04em] sm:text-base">
        Sports Cappers Leaderboard
      </span>
    </span>
  );
}
