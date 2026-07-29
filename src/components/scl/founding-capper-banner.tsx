"use client";

import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  FOUNDING_BANNER_BODY,
  FOUNDING_BANNER_CTA,
  FOUNDING_BANNER_HEADLINE,
  FOUNDING_BANNER_SECONDARY,
} from "@/lib/cold-start-copy";

/**
 * Editorial founding-roster recruitment — integrated strip, not a pop-up.
 */
export function FoundingCapperBanner() {
  return (
    <section
      aria-labelledby="founding-cappers-title"
      className="border-border scl-board overflow-hidden rounded-xl border"
    >
      <div className="flex flex-col gap-5 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8 sm:p-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="bg-surface-2 text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Users className="size-4" aria-hidden />
            </span>
            <p className="scl-data text-muted-foreground text-[0.625rem] font-semibold tracking-[0.14em] uppercase">
              Founding Roster
            </p>
          </div>
          <h2
            id="founding-cappers-title"
            className="scl-display mt-3 text-xl font-bold tracking-[0.04em] text-balance uppercase sm:text-2xl"
          >
            {FOUNDING_BANNER_HEADLINE}
          </h2>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed sm:text-base">
            {FOUNDING_BANNER_BODY}
          </p>
          <p className="text-muted-foreground mt-3 max-w-2xl text-xs leading-relaxed">
            {FOUNDING_BANNER_SECONDARY}
          </p>
        </div>
        <Button
          render={<Link href="/signup" />}
          nativeButton={false}
          variant="brand"
          size="lg"
          className="min-h-10 w-full shrink-0 gap-2 sm:mt-1 sm:w-auto"
        >
          {FOUNDING_BANNER_CTA}
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </section>
  );
}
