"use client";

import { useState, type CSSProperties } from "react";

import { cn } from "@/lib/utils";
import {
  getLeagueIdentity,
  leagueMarkInitials,
  leagueMarkTextColor,
  type LeagueIdentity,
} from "@/lib/leagues";

/** Compact league mark — self-hosted SVG when manifest lists it; color+initials fallback otherwise. */
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
  const league = leagueProp ?? getLeagueIdentity(leagueKey ?? "");
  const [failed, setFailed] = useState(false);
  const showLogo = Boolean(league.logoUrl) && !failed;
  const style = {
    backgroundColor: showLogo ? "transparent" : league.primaryColor,
    color: leagueMarkTextColor(league),
  } satisfies CSSProperties;

  const sizeClass =
    size === "sm"
      ? "size-5 text-[0.55rem]"
      : size === "lg"
        ? "size-11 text-sm"
        : "size-7 text-[0.62rem]";

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden font-bold tracking-wide",
        sizeClass,
        showLogo
          ? "rounded-md bg-transparent"
          : "border-border/60 rounded-xl border shadow-xs",
        className,
      )}
      style={style}
      title={league.name}
      aria-hidden
    >
      {showLogo ? (
        // Local /marks SVG; plain img keeps onError fallback reliable.
        // eslint-disable-next-line @next/next/no-img-element -- onError + tiny local SVG
        <img
          src={league.logoUrl}
          alt=""
          className="size-full object-contain"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        leagueMarkInitials(league)
      )}
    </span>
  );
}
