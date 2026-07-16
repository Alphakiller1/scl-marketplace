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
}: {
  className?: string;
  label?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger
        className={cn(
          "border-border text-muted-foreground inline-flex min-h-10 items-center gap-1.5 rounded-md border px-2.5 text-[0.7rem] font-semibold tracking-wide uppercase",
          className,
        )}
        aria-label={`${label}: what provisional record means`}
      >
        {label}
        <CircleHelp className="size-3.5 shrink-0 opacity-80" aria-hidden />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle className="scl-display text-base tracking-wide uppercase">
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
