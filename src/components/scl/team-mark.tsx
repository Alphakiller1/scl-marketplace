import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import { readableTextColor, type TeamIdentity } from "@/lib/teams";

/** Compact team monogram — board + pick surfaces (square on the board via className). */
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
        "scl-display border-border/60 flex shrink-0 items-center justify-center rounded-full border font-bold tracking-wide shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]",
        size === "sm" ? "size-5 text-[0.55rem]" : "size-[30px] text-xs",
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
