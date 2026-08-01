import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  PauseCircle,
  UserPlus,
} from "lucide-react";

import { storeStatusLabel } from "@/lib/store-connection";
import type {
  StorefrontCoverage,
  StorefrontCoverageEntry,
} from "@/lib/queries/store";
import { cn } from "@/lib/utils";

type Bucket = {
  key: keyof Omit<StorefrontCoverage, "failed">;
  label: string;
  hint: string;
  icon: typeof CheckCircle2;
  tone: string;
};

/**
 * Storefront revenue coverage across the whole active roster. Every capper lands
 * in exactly one bucket so admins can see who is earning, who is waiting on SCL
 * (the action queue), who stalled mid-setup, and who never started (outreach).
 */
const BUCKETS: Bucket[] = [
  {
    key: "pipeline",
    label: "Waiting on SCL",
    hint: "Capper completed their affiliate steps — accept the invite and import package links.",
    icon: Clock,
    tone: "text-amber-400",
  },
  {
    key: "live",
    label: "Live & earning",
    hint: "Packages published on the SCL profile with affiliate attribution.",
    icon: CheckCircle2,
    tone: "text-[color:var(--scl-win-text)]",
  },
  {
    key: "stalled",
    label: "Started, not submitted",
    hint: "Picked a platform but never confirmed the affiliate setup — likely has a storefront that isn't synced to SCL.",
    icon: PauseCircle,
    tone: "text-[color:var(--scl-blue)]",
  },
  {
    key: "neverStarted",
    label: "No storefront yet",
    hint: "No connection started — the Winible onboarding outreach list.",
    icon: UserPlus,
    tone: "text-[color:var(--scl-muted-data)]",
  },
  {
    key: "blocked",
    label: "Blocked",
    hint: "Needs attention or suspended — revenue is paused until resolved.",
    icon: AlertTriangle,
    tone: "text-[color:var(--scl-loss-text)]",
  },
];

function nameFor(entry: StorefrontCoverageEntry): string {
  const handle = entry.handle?.replace(/^@/, "");
  return entry.displayName?.trim() || (handle ? `@${handle}` : entry.email);
}

export function StorefrontCoveragePanel({
  coverage,
}: {
  coverage: StorefrontCoverage;
}) {
  if (coverage.failed) {
    return (
      <p className="text-muted-foreground border-border rounded-xl border p-4 text-sm">
        Coverage is temporarily unavailable — the storefront queue above is
        unaffected.
      </p>
    );
  }

  const total = BUCKETS.reduce((sum, b) => sum + coverage[b.key].length, 0);

  return (
    <section className="border-border overflow-hidden rounded-xl border">
      <header className="border-border bg-surface-2 flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
        <h2 className="scl-display text-sm font-bold tracking-[0.05em] uppercase">
          Roster coverage
        </h2>
        <p className="text-muted-foreground text-xs">
          {total} active {total === 1 ? "capper" : "cappers"} · every capper in
          exactly one state
        </p>
      </header>

      <div className="divide-border divide-y">
        {BUCKETS.map((bucket) => {
          const entries = coverage[bucket.key];
          const Icon = bucket.icon;
          return (
            <div key={bucket.key} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Icon
                  className={cn("size-4 shrink-0", bucket.tone)}
                  aria-hidden
                />
                <h3 className="text-sm font-semibold">{bucket.label}</h3>
                <span className="scl-data bg-surface-3 text-muted-foreground rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums">
                  {entries.length}
                </span>
              </div>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                {bucket.hint}
              </p>
              {entries.length ? (
                <CoverageList count={entries.length} label={bucket.label}>
                  {entries.map((entry) => {
                    const label = nameFor(entry);
                    const status = entry.status
                      ? storeStatusLabel(
                          entry.status as Parameters<
                            typeof storeStatusLabel
                          >[0],
                        )
                      : null;
                    // Admin destinations only. A capper awaiting approval is
                    // usually not publicly eligible yet, so linking to
                    // /cappers/<handle> 404s — send admins to the screen where
                    // they can actually act on this storefront.
                    const href = entry.connectionId
                      ? `/admin/store-setup?id=${entry.connectionId}`
                      : `/admin/cappers/${entry.userId}`;
                    return (
                      <li key={entry.capperId} className="min-w-0">
                        <Link
                          href={href}
                          className="border-border bg-card inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:border-[color:var(--scl-blue)]"
                        >
                          <span className="truncate">{label}</span>
                          {status ? (
                            <span className="text-muted-foreground shrink-0 text-[0.65rem]">
                              {status}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </CoverageList>
              ) : (
                <p className="text-muted-foreground mt-2 text-xs italic">
                  None.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Buckets are wildly uneven — one holds a couple of pending storefronts, the
 * onboarding backlog holds the entire roster. Rendering every chip inline made
 * the long bucket bury the short ones, which are the actionable ones. Anything
 * past a screenful collapses behind a native disclosure so the counts stay
 * comparable at a glance; `<details>` keeps it keyboard- and screen-reader
 * friendly without a client component.
 */
const COVERAGE_INLINE_LIMIT = 24;

function CoverageList({
  count,
  label,
  children,
}: {
  count: number;
  label: string;
  children: React.ReactNode;
}) {
  const list = <ul className="mt-2.5 flex flex-wrap gap-1.5">{children}</ul>;
  if (count <= COVERAGE_INLINE_LIMIT) return list;
  return (
    <details className="group mt-2.5">
      <summary className="text-muted-foreground hover:text-foreground inline-flex min-h-10 cursor-pointer items-center text-xs font-medium">
        <span className="group-open:hidden">
          Show all {count} &middot; {label}
        </span>
        <span className="hidden group-open:inline">Hide {label}</span>
      </summary>
      {list}
    </details>
  );
}
