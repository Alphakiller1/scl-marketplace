"use client";

import { useState } from "react";
import { User } from "lucide-react";

import { extractPlayerName, type HeadshotLeague } from "@/lib/player-headshots";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Avatar for a player-prop row.
 *
 * The athlete name is parsed out of the selection and resolved by
 * `/api/player-image`, which looks anyone up in ESPN's athlete search — so this
 * covers the whole live board, not a hand-picked roster. The browser/CDN cache
 * the redirect target, and a miss degrades to initials (then a person glyph)
 * instead of a broken image.
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
  const name = extractPlayerName(selection);
  const [failed, setFailed] = useState(false);

  const src = name
    ? `/api/player-image?name=${encodeURIComponent(name)}${
        league ? `&league=${league}` : ""
      }`
    : null;

  return (
    <span
      className={cn(
        "border-border bg-surface-2 relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- resolves to an external ESPN CDN url, not a bundled asset
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : name ? (
        <span className="text-muted-foreground text-[0.6rem] font-bold">
          {initials(name)}
        </span>
      ) : (
        <User className="text-muted-foreground size-[55%]" />
      )}
    </span>
  );
}
