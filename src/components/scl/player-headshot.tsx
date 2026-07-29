"use client";

import { useState } from "react";
import { User } from "lucide-react";

import {
  espnHeadshotUrl,
  resolvePlayerHeadshot,
  type HeadshotLeague,
} from "@/lib/player-headshots";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Avatar for a player-prop row. Resolves a real ESPN headshot from the player
 * named in `selection`; falls back to their initials if the image 404s, or a
 * generic person glyph when the prop names a player we don't have a headshot
 * for. Only mount this for player-prop selections.
 */
export function PlayerHeadshot({
  selection,
  league,
  size = 28,
  className,
}: {
  selection: string;
  league?: HeadshotLeague;
  size?: number;
  className?: string;
}) {
  const player = resolvePlayerHeadshot(selection, league);
  const [failed, setFailed] = useState(false);

  return (
    <span
      className={cn(
        "border-border bg-surface-2 relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {player && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- external ESPN CDN, not a bundled asset
        <img
          src={espnHeadshotUrl(player.league, player.espnId)}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : player ? (
        <span className="text-muted-foreground text-[0.6rem] font-bold">
          {initials(player.name)}
        </span>
      ) : (
        <User className="text-muted-foreground size-[55%]" />
      )}
    </span>
  );
}
