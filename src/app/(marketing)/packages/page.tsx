import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  PackageOpen,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";

import { SectionHeader } from "@/components/scl/section";
import { EmptyState } from "@/components/scl/states";
import { Button } from "@/components/ui/button";
import { STOREFRONT_PAYMENT_DISCLAIMER } from "@/lib/cold-start-copy";

export const metadata: Metadata = {
  title: "Packages",
  description:
    "Browse approved capper packages published through SCL. Payments stay on each capper’s external storefront.",
};

const STEPS = [
  {
    icon: Users,
    title: "Inspect The Record First",
    body: "Open a capper profile and check graded sample, units, ROI, and verification before you buy anything off-platform.",
  },
  {
    icon: Store,
    title: "Packages Link Out",
    body: "Approved offers point to the capper’s own storefront (Whop, Winible, DubClub, or similar). SCL does not checkout.",
  },
  {
    icon: ShieldCheck,
    title: "Trust The Receipt Trail",
    body: "SCL’s job is transparent picks and rankings. Use the public board to decide who earns your attention.",
  },
] as const;

export default function PackagesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <SectionHeader
        icon={PackageOpen}
        title="Packages"
        subtitle="Approved capper offers — inspect the record, then leave SCL to pay"
      />

      <EmptyState
        className="mt-6"
        icon={PackageOpen}
        title="No Packages Live Yet"
        description="The founding marketplace is still forming. When approved packages publish, they will appear here with a clear path to each capper’s external checkout."
        action={
          <div className="flex w-full max-w-md flex-col items-stretch gap-3 sm:items-center">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button
                render={<Link href="/cappers" />}
                nativeButton={false}
                className="min-h-11 gap-2"
              >
                Browse Cappers
                <ArrowRight className="size-4" aria-hidden />
              </Button>
              <Button
                render={<Link href="/leaderboard" />}
                nativeButton={false}
                variant="outline"
                className="min-h-11"
              >
                View Leaderboard
              </Button>
            </div>
            <Button
              render={<Link href="/picks" />}
              nativeButton={false}
              variant="ghost"
              className="min-h-11"
            >
              See Latest Picks
            </Button>
          </div>
        }
      />

      <section className="mt-10 space-y-4" aria-labelledby="packages-how">
        <h2
          id="packages-how"
          className="text-sm font-bold tracking-wide uppercase"
        >
          How Packages Work On SCL
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="border-border bg-card rounded-xl border p-4"
            >
              <span className="bg-surface-2 text-muted-foreground flex size-9 items-center justify-center rounded-lg">
                <Icon className="size-4" aria-hidden />
              </span>
              <p className="mt-3 text-sm font-semibold">{title}</p>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                {body}
              </p>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {STOREFRONT_PAYMENT_DISCLAIMER}
        </p>
      </section>
    </div>
  );
}
