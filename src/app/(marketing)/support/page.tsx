import type { Metadata } from "next";
import { LifeBuoy, Mail } from "lucide-react";

import { SupportForm } from "@/components/scl/support-form";

export const metadata: Metadata = {
  title: "Support",
  description: "Contact Sports Cappers Leaderboard support.",
};

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <header>
        <div className="flex items-center gap-2">
          <LifeBuoy
            className="size-5 text-[color:var(--scl-pink)]"
            aria-hidden
          />
          <p className="scl-eyebrow text-[color:var(--scl-muted-label)]">
            Support
          </p>
        </div>
        <h1 className="scl-display mt-3 text-4xl font-bold tracking-[0.02em]">
          How can we help?
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl leading-relaxed">
          Send account, profile, grading, package-link, or technical questions
          to the SCL team. Include the affected page when possible.
        </p>
      </header>

      <section className="border-border bg-card mt-8 rounded-2xl border p-5 sm:p-7">
        <SupportForm />
      </section>

      <p className="text-muted-foreground mt-6 flex items-center gap-2 text-sm">
        <Mail className="size-4" aria-hidden />
        Prefer email? Write to{" "}
        <a className="scl-link" href="mailto:support@scl.com">
          support@scl.com
        </a>
        .
      </p>
    </div>
  );
}
