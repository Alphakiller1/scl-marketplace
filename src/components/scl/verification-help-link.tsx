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
import { Button } from "@/components/ui/button";

/**
 * Mobile-friendly trust explainer (not hover-only).
 * Keeps Verified Account vs Board-verified Pick distinct.
 */
export function VerificationHelpLink({ className }: { className?: string }) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={
              className ??
              "text-muted-foreground hover:text-foreground inline-flex min-h-11 gap-1.5 px-2 text-xs font-medium"
            }
          />
        }
      >
        <CircleHelp className="size-4" aria-hidden />
        How verification works
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="scl-display text-lg tracking-wide uppercase">
            How verification works
          </DialogTitle>
          <DialogDescription>
            Short definitions for account checks, board-verified picks, logged
            picks, and small samples — authenticity, not results.
          </DialogDescription>
        </DialogHeader>
        <div className="text-muted-foreground space-y-3 text-sm leading-relaxed">
          <p>
            <span className="text-foreground font-medium">
              Verified account
            </span>{" "}
            means the capper completed SCL identity checks. It is not a promise
            that every pick wins.
          </p>
          <p>
            <span className="text-foreground font-medium">
              Board-verified pick
            </span>{" "}
            means the odds were captured before the event started and checked
            against a live sportsbook board. Authenticity and timing — not the
            final result.
          </p>
          <p>
            <span className="text-foreground font-medium">Logged</span> means
            the pick was recorded by the capper without a full board check.
            Still inspectable; not the same trust tier.
          </p>
          <p>
            <span className="text-foreground font-medium">
              Provisional / Building a record
            </span>{" "}
            means the graded sample is still small. Rank and ROI can swing hard
            until more results settle.
          </p>
          <p className="text-xs">
            SCL does not process payments. Storefront checkouts leave SCL for a
            third-party provider.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
