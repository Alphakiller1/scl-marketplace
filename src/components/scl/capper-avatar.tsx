"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

const SIZE_CONFIG = {
  sm: { className: "size-8 text-xs", pixel: 32, sizes: "32px" },
  md: { className: "size-16 text-sm", pixel: 64, sizes: "64px" },
  lg: { className: "size-16 text-base", pixel: 64, sizes: "64px" },
  xl: { className: "size-20 text-xl", pixel: 80, sizes: "80px" },
  xxl: { className: "size-28 text-2xl", pixel: 112, sizes: "112px" },
} as const;

export function CapperAvatar({
  name,
  src,
  size = "md",
  className,
  priority = false,
}: {
  name: string;
  src?: string;
  size?: keyof typeof SIZE_CONFIG;
  className?: string;
  /** Prefer LCP on the public profile hero avatar. */
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const config = SIZE_CONFIG[size];
  const showImage = Boolean(src) && !failed;

  return (
    <Avatar className={cn(config.className, "rounded-xl", className)}>
      {showImage && src ? (
        <Image
          src={src}
          alt={name}
          width={config.pixel}
          height={config.pixel}
          sizes={config.sizes}
          priority={priority}
          className="aspect-square size-full rounded-xl object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <AvatarFallback
          className="scl-avatar-fallback text-avatar-foreground rounded-xl font-semibold"
          style={avatarFallbackStyle(name)}
        >
          {initials(name)}
        </AvatarFallback>
      )}
    </Avatar>
  );
}
