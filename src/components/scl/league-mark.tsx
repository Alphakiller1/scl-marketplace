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
  // Prefer identity URL (ESPN CDN for majors), then self-hosted PNG/SVG.
  const src =
    league.logoUrl ??
    leagueMarkSrc(rawKey) ??
    leagueMarkSrc(league.key) ??
    leagueMarkSrc(normalizeLeagueKey(rawKey));
  const [failed, setFailed] = useState(false);
  const [srcIndex, setSrcIndex] = useState(0);
  const candidates = [
    league.logoUrl,
    leagueMarkSrc(rawKey),
    leagueMarkSrc(league.key),
  ].filter((value, index, all): value is string =>
    Boolean(value && all.indexOf(value) === index),
  );
  const activeSrc = candidates[srcIndex] ?? src;
  const showLogo = Boolean(activeSrc) && !failed;
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
        // ESPN CDN or self-hosted PNG; try next candidate before initials.
        // eslint-disable-next-line @next/next/no-img-element -- onError + remote/local marks
        <img
          key={activeSrc}
          src={activeSrc}
          alt=""
          width={px}
          height={px}
          className="size-full object-contain p-0.5"
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => {
            if (srcIndex + 1 < candidates.length) {
              setSrcIndex((i) => i + 1);
              return;
            }
            setFailed(true);
          }}
        />
      ) : (
        initials
      )}
      {showLogo ? <span className="sr-only">{initials}</span> : null}
    </span>
  );
}
