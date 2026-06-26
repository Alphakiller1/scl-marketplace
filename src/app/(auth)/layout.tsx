import Link from "next/link";
import { TrendingUp } from "lucide-react";

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
        className="mb-8 flex items-center gap-2 text-lg font-semibold"
      >
        <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
          <TrendingUp className="size-5" />
        </span>
        SCL
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
