import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PASSWORD_POLICY_SUMMARY } from "@/lib/password-policy";

/**
 * Prompt shown to a capper who signed in with a password carried over from the
 * previous platform that no longer meets the current requirements. Deliberately
 * a prompt and not a wall — the account works normally until they change it, and
 * the emailed notice says the same thing.
 */
export function PasswordUpdateNotice() {
  return (
    <div className="border-border bg-surface-2 mb-5 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <ShieldAlert
          className="mt-0.5 size-5 shrink-0 text-[color:var(--scl-blue)]"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Update your password</p>
          <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
            You&apos;re signed in with the password from your previous SCL
            account. It&apos;s shorter than our current requirement of{" "}
            {PASSWORD_POLICY_SUMMARY} — choose a new one when you get a moment.
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="min-h-10 shrink-0"
        render={<Link href="/dashboard/security" />}
        nativeButton={false}
      >
        Update password
      </Button>
    </div>
  );
}
