import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import { readableTextColor, type TeamIdentity } from "@/lib/teams";

/** Compact team abbr mark — shared by the odds board and pick surfaces. */
export function TeamMark({
  team,
  size = "md",
  className,
}: {
  team: TeamIdentity;
  size?: "sm" | "md";
  className?: string;
}) {
  const style = {
    backgroundColor: team.primaryColor,
    color: readableTextColor(team.primaryColor),
  } satisfies CSSProperties;

  return (
    <span
      className={cn(
        "border-border/60 flex shrink-0 items-center justify-center rounded-full border font-bold tracking-wide shadow-xs",
        size === "sm" ? "size-5 text-[0.55rem]" : "size-7 text-[0.62rem]",
        className,
      )}
      style={style}
      title={team.fullName}
      aria-hidden
    >
      {team.abbr}
    </span>
  );
}
