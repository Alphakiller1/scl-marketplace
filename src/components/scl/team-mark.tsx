"use client";

import { useState, type CSSProperties } from "react";

import { cn } from "@/lib/utils";
import { readableTextColor, type TeamIdentity } from "@/lib/teams";

/** Compact team mark: self-hosted SVG when manifest lists it; color+abbr fallback otherwise. */
export function TeamMark({
  team,
  size = "md",
  className,
}: {
  team: TeamIdentity;
  size?: "sm" | "md";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showLogo = Boolean(team.logoUrl) && !failed;
  const style = {
    backgroundColor: showLogo ? "transparent" : team.primaryColor,
    color: readableTextColor(team.primaryColor),
  } satisfies CSSProperties;

  return (
    <span
      className={cn(
        "scl-display border-border/60 relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border font-bold tracking-wide shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]",
        size === "sm" ? "size-5 text-[0.55rem]" : "size-[30px] text-xs",
        showLogo ? "bg-background" : null,
        className,
      )}
      style={style}
      title={team.fullName}
      aria-hidden
    >
      {showLogo ? (
        // Local /marks SVG; plain img keeps onError fallback reliable.
        // eslint-disable-next-line @next/next/no-img-element -- onError + tiny local SVG
        <img
          src={team.logoUrl}
          alt=""
          className="size-full object-contain p-0.5"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        team.abbr
      )}
    </span>
  );
}
