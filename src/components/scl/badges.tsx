import { BadgeCheck, History, Trophy } from "lucide-react";

import { LeagueMark } from "@/components/scl/league-mark";
import { cn } from "@/lib/utils";
import { SPORTS } from "@/lib/constants";
import { getLeagueIdentity, leagueMarkInitials } from "@/lib/leagues";
import type { PickStatus } from "@/lib/mock";
import {
  ACCOUNT_VERIFIED_TOOLTIP,
  isVerifiedTier,
  verificationTierMeta,
  type VerificationTier,
} from "@/lib/verification";

/** Verified handicapper marker — account identity, not pick authenticity. */
export function VerificationBadge({
  size = "sm",
  withLabel = false,
  className,
}: {
  size?: "xs" | "sm" | "md";
  withLabel?: boolean;
  className?: string;
}) {
  const px = size === "xs" ? "size-3.5" : size === "md" ? "size-5" : "size-4";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[color:var(--scl-pink)]",
        className,
      )}
      title={ACCOUNT_VERIFIED_TOOLTIP}
    >
      <BadgeCheck className={px} aria-label="Verified account" />
      {withLabel ? <span className="text-xs font-medium">Verified</span> : null}
    </span>
  );
}

/**
 * Per-pick trust tier (pick integrity, §C3/M2-3). Verified/auto-verified read as a positive
 * signal; self-reported is deliberately neutral — it counts, but isn't market-checked.
 */
export function PickTierBadge({
  tier,
  className,
}: {
  tier: VerificationTier;
  className?: string;
}) {
  const meta = verificationTierMeta(tier);
  const verified = isVerifiedTier(tier);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold",
        verified
          ? "bg-[color:var(--scl-pink)]/15 text-[color:var(--scl-pink)] ring-1 ring-[color:var(--scl-pink)]/30"
          : "border-border/80 text-muted-foreground border bg-transparent",
        className,
      )}
      title={meta.description}
    >
      {verified ? <BadgeCheck className="size-3" aria-hidden /> : null}
      {meta.short}
    </span>
  );
}

/** Status/award badge for trophies and elite status. */
export function TrophyBadge({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-[color:var(--scl-line)] bg-[color:var(--scl-ink-700)] px-2 py-0.5 text-xs font-medium text-[color:var(--scl-muted-data)]",
        className,
      )}
    >
      <Trophy className="size-3" />
      {label}
    </span>
  );
}

/** Marks a capper whose record was imported from the previous SCL platform. */
export function LegacyBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "border-border bg-surface-3 text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        className,
      )}
      title="Record Imported From The Previous SCL Platform"
    >
      <History className="size-3" />
      Legacy
    </span>
  );
}

const SPORT_LABEL = new Map<string, string>(
  SPORTS.map((s) => [s.key, s.label]),
);

export function SportTag({
  sport,
  className,
  withMark = true,
  /** Dense surfaces: mark only (title carries the league name). */
  markOnly = false,
}: {
  sport: string;
  className?: string;
  /** When false, render the label chip without a LeagueMark (e.g. beside a larger mark). */
  withMark?: boolean;
  markOnly?: boolean;
}) {
  const label = SPORT_LABEL.get(sport) ?? sport;
  const league = getLeagueIdentity(sport);
  const initials = leagueMarkInitials(league);
  // Avoid "MLB" mark + "MLB" text (or monogram SVG + same acronym).
  const labelRedundant =
    label.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() ===
    initials.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const showMark = withMark;
  const showLabel = !markOnly && (!showMark || !labelRedundant);

  if (showMark && !showLabel) {
    return (
      <span className={cn("inline-flex shrink-0", className)} title={label}>
        <LeagueMark leagueKey={sport} size="md" className="rounded-md" />
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "bg-surface-3 text-muted-foreground inline-flex items-center rounded-md text-[0.7rem] font-semibold tracking-wide uppercase",
        showMark ? "gap-1 py-0.5 pr-2 pl-0.5" : "px-2 py-0.5",
        className,
      )}
      title={label}
    >
      {showMark ? (
        <LeagueMark leagueKey={sport} size="sm" className="rounded-md" />
      ) : null}
      {showLabel ? label : null}
    </span>
  );
}

const STATUS_STYLES: Record<
  PickStatus,
  { label: string; className: string; title: string; live?: boolean }
> = {
  "pre-game": {
    // Informational blue OUTLINE — public taxonomy uses "Pending" before tip.
    label: "Pending",
    title: "Event has not started. Grade locks after the final.",
    className:
      "border border-[color:var(--scl-blue)]/40 text-[color:var(--scl-blue)]",
  },
  pending: {
    label: "Pending",
    title: "Event has not started. Grade locks after the final.",
    className: "bg-muted/60 text-muted-foreground",
  },
  live: {
    label: "Live",
    title: "Event is in progress.",
    className: "bg-live/15 text-live ring-1 ring-live/30",
    live: true,
  },
  "awaiting-grade": {
    label: "Awaiting Grade",
    title: "Event is final. Settlement is running.",
    className: "bg-muted/50 text-muted-foreground",
  },
  win: {
    label: "Won",
    title: "Graded win. Past result — not a prediction.",
    className: "bg-pos/15 text-pos ring-1 ring-pos/30",
  },
  loss: {
    label: "Lost",
    title: "Graded loss.",
    className: "bg-neg/15 text-neg ring-1 ring-neg/30",
  },
  push: {
    label: "Push",
    title: "Graded push — stake returned.",
    className: "border-border text-foreground border bg-transparent",
  },
  void: {
    label: "Void",
    title: "Graded void — removed from record math per rules.",
    className: "bg-muted/40 text-muted-foreground",
  },
};

export function StatusBadge({
  status,
  className,
}: {
  status: PickStatus;
  className?: string;
}) {
  const s = STATUS_STYLES[status];
  // Only graded outcomes are a "result"; lifecycle states are a "status" — never conflate
  // the two (the M5 authenticity-vs-result split must hold at the aria layer too).
  const isResult =
    status === "win" ||
    status === "loss" ||
    status === "push" ||
    status === "void";
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        s.className,
        className,
      )}
      title={s.title}
      aria-label={`${isResult ? "Result" : "Status"}: ${s.label}. ${s.title}`}
    >
      {s.live ? (
        <span className="relative flex size-1.5">
          <span className="bg-live absolute inline-flex size-full animate-ping rounded-full opacity-75" />
          <span className="bg-live relative inline-flex size-1.5 rounded-full" />
        </span>
      ) : null}
      {s.label}
    </span>
  );
}
