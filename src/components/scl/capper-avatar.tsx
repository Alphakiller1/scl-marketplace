import type { CSSProperties } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const letters = name
    .replace(/^@/, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return letters || "SCL";
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

type AvatarFallbackStyle = CSSProperties & {
  "--avatar-hue": string;
};

function avatarFallbackStyle(seed: string): AvatarFallbackStyle {
  const hashSeed = seed.trim().toLowerCase() || "scl";
  const hue = hashString(hashSeed) % 360;
  return {
    "--avatar-hue": `${hue}deg`,
  };
}

export function CapperAvatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizes = {
    sm: "size-8 text-xs",
    md: "size-10 text-sm",
    lg: "size-14 text-base",
    xl: "size-20 text-xl",
  };
  return (
    <Avatar className={cn(sizes[size], "rounded-xl", className)}>
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback
        className="scl-avatar-fallback text-avatar-foreground rounded-xl font-semibold"
        style={avatarFallbackStyle(name)}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
