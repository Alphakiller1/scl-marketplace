import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { SclLogo } from "@/components/scl/scl-logo";

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
      <Link href="/" aria-label="SCL home" className="mb-8">
        <SclLogo className="text-lg" />
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
