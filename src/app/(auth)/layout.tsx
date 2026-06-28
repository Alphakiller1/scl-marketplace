import Link from "next/link";
import { LockKeyhole, Scale, ShieldCheck } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { SclLogo } from "@/components/scl-logo";

const trustSignals = [
  { icon: LockKeyhole, label: "Access", value: "Role protected" },
  { icon: ShieldCheck, label: "Identity", value: "Email verified" },
  { icon: Scale, label: "Policies", value: "Version recorded" },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="scl-glow pointer-events-none absolute inset-0"
      />
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto w-full max-w-5xl px-4 pt-4 sm:px-8 lg:px-10 lg:pt-12">
        <Link
          href="/"
          aria-label="SCL home"
          className="pointer-events-auto inline-flex"
        >
          <BrandLockup />
        </Link>
      </div>

      <div className="relative mx-auto grid min-h-screen w-full max-w-5xl lg:grid-cols-[minmax(0,1fr)_27rem]">
        <aside className="border-border hidden border-r px-10 py-12 lg:flex lg:flex-col lg:justify-between">
          <div className="h-9" aria-hidden />

          <div className="max-w-md">
            <p className="text-brand text-xs font-semibold uppercase">
              Sports Capper Leaderboard
            </p>
            <p className="mt-3 text-4xl font-bold">
              The identity behind the record.
            </p>
            <p className="text-muted-foreground mt-4 max-w-sm">
              Secure access, documented acceptance, and a public capper profile
              built to earn trust.
            </p>
          </div>

          <dl className="grid gap-2">
            {trustSignals.map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="border-border bg-card/60 flex items-center gap-3 rounded-xl border px-3 py-2.5"
              >
                <Icon className="text-brand size-4" aria-hidden />
                <dt className="text-muted-foreground text-sm">{label}</dt>
                <dd className="ml-auto text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </aside>

        <main className="flex min-h-screen items-center px-4 py-16 sm:px-8 lg:px-10">
          <div className="mx-auto w-full max-w-md">
            <div className="border-border bg-card rounded-xl border p-5 shadow-sm sm:p-7">
              {children}
            </div>
            <p className="text-muted-foreground mt-5 text-center text-xs">
              Sports Capper Leaderboard account security
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

function BrandLockup() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="from-brand/20 to-primary/20 ring-border-strong flex size-9 items-center justify-center rounded-xl bg-gradient-to-br ring-1">
        <SclLogo className="size-6" />
      </span>
      <span className="scl-brand-text text-lg font-extrabold">SCL</span>
    </span>
  );
}
