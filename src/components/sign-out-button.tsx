"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => signOut({ callbackUrl: "/" })}
      className={cn("min-h-11 min-w-11 gap-1.5 md:h-11", className)}
    >
      <LogOut className="size-4" />
      <span className="hidden sm:inline">Log out</span>
      <span className="sm:hidden">Log Out</span>
    </Button>
  );
}
