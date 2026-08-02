import type { Metadata } from "next";
import { BadgeCheck, Clock3, LineChart, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "How Verification Works",
  description:
    "How Sports Cappers Leaderboard authenticates submitted odds and independently grades pick results.",
};

const stages = [
  {
    icon: ShieldCheck,
    title: "Odds Verification",
    body: "SCL synchronizes odds from multiple sportsbooks so cappers can shop available lines and bettors can trust that submitted odds were authentic.",
  },
  {
    icon: BadgeCheck,
    title: "Record Verification",
    body: "Pick results are automatically graded by Sports Cappers Leaderboard, independently from the capper who submitted the pick.",
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
          Every current SCL record is built around two checks: authentic odds at
          submission and independent grading after the event concludes.
        </p>
      </header>

      <section
        className="mt-10 grid gap-4 md:grid-cols-2"
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
              Picks are timestamped and committed before the scheduled event
              starts. A committed pick cannot be quietly rewritten afterward.
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

      <p className="text-muted-foreground mt-8 max-w-3xl text-sm leading-relaxed">
        A verified submission does not mean a pick won. Win, loss, push, and
        pending are result states recorded separately from the verification
        checks above. Historical carried records remain identified by their
        original provenance.
      </p>
    </div>
  );
}
