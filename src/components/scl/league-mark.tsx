"use client";

import { useState, type CSSProperties } from "react";

import { cn } from "@/lib/utils";
import {
  getLeagueIdentity,
  leagueMarkInitials,
  leagueMarkTextColor,
  type LeagueIdentity,
} from "@/lib/leagues";
import { leagueMarkSrc, normalizeLeagueKey } from "@/lib/mark-manifest";

const SIZE_PX = { sm: 20, md: 28, lg: 44 } as const;

/**
 * Compact league mark — self-hosted SVG when manifest lists it (BookMark pattern);
 * color + initials fallback otherwise. Always paints a visible tile (never empty).
 */
export function LeagueMark({
  league: leagueProp,
  leagueKey,
  size = "md",
  className,
}: {
  league?: LeagueIdentity;
  /** Sport/league key when you don't already have a LeagueIdentity. */
  leagueKey?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const rawKey = leagueKey ?? leagueProp?.key ?? "";
  const league = leagueProp ?? getLeagueIdentity(rawKey);
  const src =
    league.logoUrl ??
    leagueMarkSrc(rawKey) ??
    leagueMarkSrc(league.key) ??
    leagueMarkSrc(normalizeLeagueKey(rawKey));
  const [failed, setFailed] = useState(false);
  const showLogo = Boolean(src) && !failed;
  const px = SIZE_PX[size];
  const initials = leagueMarkInitials(league);
  const style = {
    width: px,
    height: px,
    backgroundColor: showLogo ? "#ffffff" : league.primaryColor,
    color: leagueMarkTextColor(league),
    fontSize: Math.max(8, Math.round(px * 0.34)),
  } satisfies CSSProperties;

  return (
    <span
      className={cn(
        "border-border/50 relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border font-bold tracking-wide shadow-xs",
        className,
      )}
      style={style}
      title={league.name}
      aria-hidden
    >
      {showLogo ? (
        // Self-hosted PNG or ESPN CDN; plain img keeps onError → initials reliable.
        // eslint-disable-next-line @next/next/no-img-element -- onError + remote/local marks
        <img
          src={src}
          alt=""
          width={px}
          height={px}
          className="size-full object-contain p-0.5"
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        initials
      )}
      {showLogo ? <span className="sr-only">{initials}</span> : null}
    </span>
  );
}
