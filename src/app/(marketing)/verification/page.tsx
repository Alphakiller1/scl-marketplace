import type { Metadata } from "next";
import {
  BadgeCheck,
  Clock3,
  LineChart,
  Scale,
  ShieldCheck,
} from "lucide-react";

import { SCL_BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "How Verification Works",
  description: `How ${SCL_BRAND_NAME} uses standardized sportsbook market data and independent grading to verify records consistently.`,
};

const stages = [
  {
    icon: ShieldCheck,
    title: "Odds Verification",
    body: "SCL captures sportsbook odds and uses that market data as a consistent reference when evaluating submitted picks.",
  },
  {
    icon: BadgeCheck,
    title: "Record Verification",
    body: `Pick results are automatically graded by ${SCL_BRAND_NAME}, independently of the capper.`,
  },
  {
    icon: Scale,
    title: "Consistent Standards",
    body: "The same underlying odds data and grading methodology are applied across cappers, giving bettors a consistent way to compare performance.",
  },
] as const;

export default function VerificationPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <header className="max-w-3xl">
        <p className="scl-eyebrow text-[color:var(--scl-muted-label)]">
          Transparent by design
        </p>
        <h1 className="scl-display mt-3 text-4xl font-bold tracking-[0.02em] sm:text-5xl">
          How Verification Works
        </h1>
        <p className="text-muted-foreground mt-4 text-base leading-relaxed sm:text-lg">
          SCL uses standardized sportsbook market data to help verify picks and
          results.
        </p>
      </header>

      <section
        className="mt-10 grid gap-4 md:grid-cols-3"
        aria-label="Verification stages"
      >
        {stages.map(({ icon: Icon, title, body }) => (
          <article
            key={title}
            className="border-border bg-card rounded-2xl border p-5 sm:p-6"
          >
            <Icon className="size-6 text-[color:var(--scl-pink)]" aria-hidden />
            <h2 className="scl-display mt-4 text-xl font-bold">{title}</h2>
            <p className="text-muted-foreground mt-2 leading-relaxed">{body}</p>
          </article>
        ))}
      </section>

      <section className="border-border mt-10 grid gap-5 border-y py-8 sm:grid-cols-2">
        <div className="flex gap-3">
          <Clock3
            className="mt-0.5 size-5 shrink-0 text-[color:var(--scl-blue)]"
            aria-hidden
          />
          <div>
            <h2 className="font-semibold">Entered Before Lock</h2>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Picks are timestamped and can only be entered before the scheduled
              event starts. Picks are not editable after they are made.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <LineChart
            className="mt-0.5 size-5 shrink-0 text-[color:var(--scl-blue)]"
            aria-hidden
          />
          <div>
            <h2 className="font-semibold">Closing Line and CLV</h2>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              When a closing price is available, SCL records it and calculates
              Closing Line Value. Historical records without a captured close
              remain blank rather than being estimated.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
