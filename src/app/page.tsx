import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  ShieldCheck,
  Smartphone,
  Trophy,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/site-header";

const features = [
  {
    icon: BarChart3,
    title: "Verified track records",
    body: "Every play is logged, graded, and tallied. No screenshots, no editing history.",
  },
  {
    icon: Trophy,
    title: "Public leaderboard",
    body: "Climb the rankings on real ROI and units won. Let your record do the selling.",
  },
  {
    icon: ShieldCheck,
    title: "Fair, auditable grading",
    body: "Automated where data is reliable, with admin review and a full audit trail.",
  },
  {
    icon: Smartphone,
    title: "Mobile-first",
    body: "Enter plays, build slips, and manage packages from anywhere in seconds.",
  },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_0%,var(--color-primary)/0.12,transparent_70%)]"
          />
          <div className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6 sm:py-32">
            <Badge variant="secondary" className="mb-6 gap-1.5">
              <BadgeCheck className="size-3.5" />
              Phase 1 — Marketplace foundation
            </Badge>
            <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-6xl">
              Prove your edge. Build your following.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
              SCL is the marketplace where sports cappers log every play, earn a
              verified record, and turn it into a real audience.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                render={<Link href="/signup" />}
                size="lg"
                className="gap-2"
              >
                Become a capper <ArrowRight className="size-4" />
              </Button>
              <Button
                render={<Link href="/leaderboard" />}
                size="lg"
                variant="outline"
              >
                View leaderboard
              </Button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, body }) => (
              <Card key={title} className="border-border/60">
                <CardContent className="pt-6">
                  <span className="mb-4 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} Sports Capper League</p>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
