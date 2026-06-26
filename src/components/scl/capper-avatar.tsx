import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
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
      <AvatarFallback className="bg-surface-3 text-foreground rounded-xl font-semibold">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
