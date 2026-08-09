"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { Activity, Sparkles, TrendingUp, Trophy } from "lucide-react";

import { LeagueMark } from "@/components/scl/league-mark";
import { formatClvPts } from "@/lib/proof-receipt";
import type { LiveTickerItem } from "@/lib/queries/live-activity-ticker";
import { cn } from "@/lib/utils";

function formatWinUnits(profitUnits: number | null | undefined): string {
  if (profitUnits == null || !Number.isFinite(profitUnits)) return "—";
  const rounded = Math.round(profitUnits * 100) / 100;
  const text = Math.abs(rounded).toFixed(2).replace(/\.00$/, "");
  if (rounded > 0) return `+${text}U`;
  if (rounded < 0) return `−${text}U`;
  return "0U";
}

function kindMeta(kind: LiveTickerItem["kind"]): {
  label: string;
  Icon: typeof Trophy;
  tone: string;
} {
  switch (kind) {
    case "win":
      return {
        label: "Won",
        Icon: Trophy,
        tone: "text-pos",
      };
    case "clv":
      return {
        label: "Beat Close",
        Icon: TrendingUp,
        tone: "text-pos",
      };
    case "posted":
      return {
        label: "New Pick",
        Icon: Sparkles,
        tone: "text-foreground",
      };
  }
}

function itemAriaText(item: LiveTickerItem): string {
  const meta = kindMeta(item.kind);
  if (item.kind === "win") {
    return `@${item.handle} ${item.sport} ${meta.label} ${formatWinUnits(item.profitUnits)}`;
  }
  if (item.kind === "clv") {
    return `@${item.handle} ${item.sport} ${meta.label} ${formatClvPts(item.clvPts)}`;
  }
  return `@${item.handle} ${item.sport} ${meta.label}`;
}

/** Pad a short list so the marquee fills wide viewports, then duplicate for seamless -50% loop. */
function buildMarqueeItems(items: LiveTickerItem[]): LiveTickerItem[] {
  if (items.length === 0) return [];
  const unit: LiveTickerItem[] = [...items];
  while (unit.length < 10) {
    unit.push(...items);
  }
  return [...unit, ...unit];
}

function TickerChip({
  item,
  interactive,
  className,
}: {
  item: LiveTickerItem;
  interactive: boolean;
  className?: string;
}) {
  const meta = kindMeta(item.kind);
  const Icon = meta.Icon;

  const handle = interactive ? (
    <Link
      href={`/cappers/${item.handle}`}
      className="font-semibold text-[color:var(--scl-text)] underline decoration-[color:var(--scl-blue)]/50 underline-offset-2 hover:decoration-[color:var(--scl-blue)]"
    >
      @{item.handle}
    </Link>
  ) : (
    <span className="font-semibold text-[color:var(--scl-text)]">
      @{item.handle}
    </span>
  );

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-[var(--scl-radius-chip)] border border-[color:var(--scl-line)] bg-[color:var(--scl-ink-800)] px-2.5 py-1 text-xs shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]",
        item.kind === "win" &&
          "border-[color-mix(in_srgb,var(--scl-win)_35%,var(--scl-line))]",
        item.kind === "clv" &&
          "border-[color-mix(in_srgb,var(--scl-win)_28%,var(--scl-line))]",
        item.kind === "posted" &&
          "border-[color-mix(in_srgb,var(--scl-blue)_40%,var(--scl-line))]",
        className,
      )}
    >
      <LeagueMark leagueKey={item.sport} size="sm" className="shrink-0" />
      {handle}
      <span className="text-muted-foreground" aria-hidden>
        ·
      </span>
      <span className="scl-data text-muted-foreground text-[0.65rem] font-semibold tracking-[0.1em] uppercase">
        {item.sport}
      </span>
      <span className="text-muted-foreground" aria-hidden>
        ·
      </span>
      <Link
        href={`/picks?receipt=${encodeURIComponent(item.receiptId)}`}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-semibold tracking-wide uppercase underline decoration-[color:var(--scl-blue)]/50 underline-offset-2 hover:decoration-[color:var(--scl-blue)]",
          meta.tone,
        )}
        aria-label={`Open receipt for @${item.handle}'s ${meta.label.toLowerCase()} wager`}
      >
        <Icon className="size-3 shrink-0 opacity-90" aria-hidden />
        {meta.label}
      </Link>
      {item.kind === "win" ? (
        <>
          <span className="text-muted-foreground" aria-hidden>
            ·
          </span>
          <span
            className={cn("scl-data font-semibold tabular-nums", meta.tone)}
          >
            {formatWinUnits(item.profitUnits)}
          </span>
        </>
      ) : null}
      {item.kind === "clv" && item.clvPts != null ? (
        <>
          <span className="text-muted-foreground" aria-hidden>
            ·
          </span>
          <span
            className={cn("scl-data font-semibold tabular-nums", meta.tone)}
          >
            {formatClvPts(item.clvPts)}
          </span>
        </>
      ) : null}
    </span>
  );
}

/**
 * Live board marquee — wins, positive CLV, new posts (sport + handle only).
 * Hidden when empty; pauses on hover; static under reduced motion.
 */
export function LiveActivityTicker({ items }: { items: LiveTickerItem[] }) {
  if (items.length === 0) {
    return (
      <section
        aria-label="Recent winning wagers"
        className="scl-board relative overflow-hidden rounded-none border-x-0 border-t-0"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5 sm:px-6">
          <p className="scl-eyebrow flex items-center gap-1.5 text-[color:var(--scl-muted-label)]">
            <Activity
              className="size-3.5 text-[color:var(--scl-blue)]"
              aria-hidden
            />
            Recent winning wagers
          </p>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Verified wins will appear here after game results are graded.
          </p>
        </div>
      </section>
    );
  }

  const marqueeItems = buildMarqueeItems(items);
  const halfCount = marqueeItems.length / 2;
  const durationSec = Math.max(32, Math.round(halfCount * 3.1));
  return (
    <section
      aria-label="Recent winning wagers and live board activity"
      className="scl-board relative overflow-hidden rounded-none border-x-0 border-t-0"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--scl-blue)_55%,transparent)_20%,color-mix(in_srgb,var(--scl-pink)_40%,transparent)_80%,transparent)]"
      />
      {/*
        At 375px the label alone is nearly the full row. Kept inline it left the
        marquee a sliver of width, so the chips were clipped off the right edge —
        the ticker read as broken. Stack on mobile: label on its own line, track
        at full width; the inline divider layout returns from `sm:` up.
      */}
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6 sm:py-3.5">
        <div className="flex shrink-0 items-center gap-2 sm:border-r sm:border-[color:var(--scl-line)] sm:pr-4">
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[color:var(--scl-blue)] opacity-40 motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-[color:var(--scl-blue)]" />
          </span>
          <p className="scl-eyebrow flex items-center gap-1.5 text-[color:var(--scl-muted-label)]">
            <Activity
              className="size-3.5 text-[color:var(--scl-blue)]"
              aria-hidden
            />
            Recent winning wagers &amp; activity
          </p>
        </div>

        <div
          className={cn(
            "group/ticker relative w-full min-w-0 overflow-hidden sm:w-auto sm:flex-1",
            "motion-reduce:hidden",
            "[mask-image:linear-gradient(to_right,transparent,black_1.25rem,black_calc(100%-1.25rem),transparent)]",
          )}
        >
          <div
            className="scl-ticker-track flex w-max items-center gap-2.5 group-focus-within/ticker:[animation-play-state:paused] group-hover/ticker:[animation-play-state:paused]"
            style={
              {
                animation: `scl-ticker ${durationSec}s linear infinite`,
              } as CSSProperties
            }
            aria-hidden="true"
          >
            {marqueeItems.map((item, i) => (
              <TickerChip
                key={`dup-${item.id}-${i}`}
                item={item}
                interactive={false}
              />
            ))}
          </div>
          <ul className="sr-only">
            {items.map((item) => (
              <li key={item.id}>
                <Link href={`/cappers/${item.handle}`}>@{item.handle}</Link>
                {" — "}
                {itemAriaText(item)}
              </li>
            ))}
          </ul>
        </div>

        <ul className="hidden w-full min-w-0 flex-wrap items-center gap-2 motion-reduce:flex sm:w-auto sm:flex-1">
          {items.slice(0, 8).map((item) => (
            <li key={`static-${item.id}`}>
              <TickerChip item={item} interactive />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
