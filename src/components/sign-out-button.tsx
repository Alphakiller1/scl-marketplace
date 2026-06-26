"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="gap-1.5"
    >
      <LogOut className="size-4" />
      <span className="hidden sm:inline">Log out</span>
    </Button>
  );
}
