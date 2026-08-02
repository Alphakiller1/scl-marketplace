"use client";

import { BadgeCheck, ShieldCheck } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ACCOUNT_VERIFIED_TOOLTIP,
  VERIFICATION_TIER_META,
} from "@/lib/verification";

export function VerificationHelpLink({ className }: { className?: string }) {
  return (
    <Dialog>
      <DialogTrigger
        className={`scl-link inline-flex min-h-10 items-center text-xs font-medium ${className ?? ""}`}
      >
        How verification works
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle className="scl-display text-base font-semibold tracking-[0.02em]">
            How verification works
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Account trust and pick authenticity are separate signals.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-4">
          <li className="flex gap-3">
            <span className="mt-0.5 shrink-0 text-[color:var(--scl-pink)]">
              <BadgeCheck className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-foreground text-sm font-semibold">
                Verified account
              </p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {ACCOUNT_VERIFIED_TOOLTIP}
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 shrink-0 text-[color:var(--scl-blue)]">
              <ShieldCheck className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-foreground text-sm font-semibold">
                Odds-verified pick
              </p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {VERIFICATION_TIER_META.VERIFIED.description}
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span
              className="border-border text-muted-foreground mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded border text-[0.6rem] font-bold"
              aria-hidden
            >
              —
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-foreground text-sm font-semibold">
                {VERIFICATION_TIER_META.SELF_REPORTED.label}
              </p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {VERIFICATION_TIER_META.SELF_REPORTED.description}
              </p>
            </div>
          </li>
        </ul>
      </DialogContent>
    </Dialog>
  );
}
