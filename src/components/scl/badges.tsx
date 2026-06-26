import { BadgeCheck, Trophy } from "lucide-react";

import { cn } from "@/lib/utils";
import { SPORTS } from "@/lib/constants";
import type { PickStatus } from "@/lib/mock";

/** Verified handicapper marker — trust is the product. */
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
      className={cn("text-live inline-flex items-center gap-1", className)}
      title="Verified record"
    >
      <BadgeCheck className={px} aria-label="Verified" />
      {withLabel ? <span className="text-xs font-medium">Verified</span> : null}
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
        "border-gold/30 bg-gold/10 text-gold inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      <Trophy className="size-3" />
      {label}
    </span>
  );
}

const SPORT_LABEL = new Map<string, string>(
  SPORTS.map((s) => [s.key, s.label]),
);

export function SportTag({
  sport,
  className,
}: {
  sport: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "bg-surface-3 text-muted-foreground inline-flex items-center rounded-md px-2 py-0.5 text-[0.7rem] font-semibold tracking-wide uppercase",
        className,
      )}
    >
      {SPORT_LABEL.get(sport) ?? sport}
    </span>
  );
}

const STATUS_STYLES: Record<
  PickStatus,
  { label: string; className: string; live?: boolean }
> = {
  pending: {
    label: "Pending",
    className: "bg-surface-3 text-muted-foreground",
  },
  live: { label: "Live", className: "bg-live/15 text-live", live: true },
  win: { label: "Win", className: "bg-pos/15 text-pos" },
  loss: { label: "Loss", className: "bg-neg/15 text-neg" },
  push: { label: "Push", className: "bg-surface-3 text-foreground" },
  void: { label: "Void", className: "bg-surface-3 text-muted-foreground" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: PickStatus;
  className?: string;
}) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold",
        s.className,
        className,
      )}
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
