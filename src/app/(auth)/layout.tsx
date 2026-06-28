import Link from "next/link";

import { SclLogo } from "@/components/scl-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div
        aria-hidden
        className="scl-glow pointer-events-none absolute inset-0 -z-10"
      />
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Link
        href="/"
        className="mb-8 flex items-center gap-2.5 text-lg font-semibold"
      >
        <span className="from-brand/20 to-primary/20 ring-border-strong flex size-9 items-center justify-center rounded-xl bg-gradient-to-br ring-1">
          <SclLogo className="size-6" />
        </span>
        <span className="scl-brand-text font-extrabold tracking-tight">
          SCL
        </span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
