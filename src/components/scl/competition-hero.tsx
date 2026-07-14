"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Ticket } from "@/components/scl/ticket";

export function CompetitionHero() {
  return (
    <section
      className="dark border-border bg-background text-foreground scl-scanline relative overflow-hidden border-b"
      aria-labelledby="scl-hero-title"
    >
      <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
        <div className="max-w-xl">
          <p className="scl-eyebrow text-gold mb-3">Verified Board Entry</p>
          <h1
            id="scl-hero-title"
            className="scl-display max-w-lg text-4xl leading-[1.02] font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl"
          >
            Records you can inspect.
          </h1>
          <p className="text-muted-foreground mt-4 max-w-lg text-base leading-relaxed text-pretty sm:text-lg">
            Every verified pick is locked to live board odds and graded
            automatically.
          </p>
          <div className="mt-6 grid gap-3 sm:mt-7 sm:flex sm:flex-wrap">
            <Button
              render={<Link href="/leaderboard" />}
              nativeButton={false}
              size="lg"
              className="min-h-11 w-full min-w-0 gap-2 whitespace-normal sm:min-h-9 sm:w-auto"
            >
              Explore Leaderboard <ArrowRight className="size-4" aria-hidden />
            </Button>
            <Button
              render={<Link href="/signup" />}
              nativeButton={false}
              size="lg"
              variant="outline"
              className="bg-background/60 min-h-11 w-full min-w-0 whitespace-normal backdrop-blur-sm sm:min-h-9 sm:w-auto"
            >
              Become A Capper
            </Button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[340px] lg:mx-0 lg:justify-self-end">
          <Ticket
            settling
            status="win"
            selectionTitle={"Aces −3.5 /\nUnder 161.5"}
            eventLine="LVA @ SEA · WNBA · SUN JUL 13, 10:00 PM ET"
            legs={2}
            odds="+264"
            stake="1.0U"
            toWin="2.64U"
            capturedAt="2026-07-13T18:22:08.000Z"
          />
        </div>
      </div>
      <div
        aria-hidden
        className="bg-gold absolute inset-x-0 bottom-0 h-px opacity-80"
      />
    </section>
  );
}
