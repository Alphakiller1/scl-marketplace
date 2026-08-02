"use client";

import { CircleHelp } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PROVISIONAL_RECORD_HELP } from "@/lib/cold-start-copy";
import { cn } from "@/lib/utils";

/**
 * Accessible provisional / building-record helper (tap + keyboard, not hover-only).
 */
export function ProvisionalRecordHelp({
  className,
  label = "Provisional",
  iconOnly = false,
}: {
  className?: string;
  label?: string;
  iconOnly?: boolean;
}) {
  return (
    <Dialog>
      <DialogTrigger
        className={cn(
          "border-border text-muted-foreground inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[0.65rem] leading-none font-semibold tracking-wide uppercase",
          iconOnly && "size-10 justify-center px-0",
          className,
        )}
        aria-label={`${label}: what provisional record means`}
      >
        {iconOnly ? <span className="sr-only">{label}</span> : label}
        <CircleHelp
          className={cn(
            "shrink-0 opacity-80",
            iconOnly ? "size-4" : "size-3.5",
          )}
          aria-hidden
        />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle className="scl-display text-base font-semibold tracking-[0.02em]">
            Provisional record
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
            {PROVISIONAL_RECORD_HELP}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
