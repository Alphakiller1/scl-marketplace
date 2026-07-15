"use client";

import { bookLabel, bookShort } from "@/lib/books";
import { formatOdds } from "@/lib/format";
import type { MovedLinePayload } from "@/lib/odds-movement";
import { cn } from "@/lib/utils";

function formatCaptureEt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("month")}·${get("day")}·${get("year")} ${get("hour")}:${get("minute")}:${get("second")} ET`;
}

function LineCard({
  line,
  onAccept,
  onRemove,
}: {
  line: MovedLinePayload;
  onAccept?: (line: MovedLinePayload) => void;
  onRemove?: (line: MovedLinePayload) => void;
}) {
  const unavailable = line.class === "unavailable";
  const book =
    line.book != null
      ? `${bookShort(line.book)} · ${bookLabel(line.book)}`
      : "Live Board";
  const lineLabel =
    line.line != null
      ? `${line.market} ${line.line > 0 ? `+${line.line}` : line.line}`
      : line.market;

  return (
    <div className="border-border space-y-3 rounded-[14px] border bg-[color:var(--scl-ink-800)] p-3">
      <div className="space-y-1">
        <p className="scl-display text-foreground text-sm font-semibold tracking-wide uppercase">
          {line.selection}
        </p>
        <p className="text-muted-foreground text-xs">
          {line.eventLabel}
          {" · "}
          {lineLabel}
          {line.player ? ` · ${line.player}` : ""}
        </p>
        <p className="scl-data text-muted-foreground text-[0.65rem] tracking-[0.08em] uppercase">
          {book}
          {" · "}
          captured {formatCaptureEt(line.verifiedAt)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-[color:var(--scl-line)] bg-[color:var(--scl-ink-700)] px-3 py-2">
          <p className="scl-eyebrow text-muted-foreground">You selected</p>
          <p className="scl-data text-foreground mt-0.5 text-lg font-semibold">
            {formatOdds(line.selectedOddsAmerican)}
          </p>
        </div>
        <div className="rounded-lg border border-[color:var(--scl-line)] bg-[color:var(--scl-ink-700)] px-3 py-2">
          <p className="scl-eyebrow text-muted-foreground">Now</p>
          <p
            className={cn(
              "scl-data mt-0.5 text-lg font-semibold",
              unavailable ? "text-muted-foreground" : "text-pink",
            )}
          >
            {unavailable || line.updatedOddsAmerican == null
              ? "—"
              : formatOdds(line.updatedOddsAmerican)}
          </p>
        </div>
      </div>

      {unavailable ? (
        <p className="text-neg text-xs font-medium">
          This line is unavailable or suspended — remove it to continue.
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        {!unavailable && onAccept ? (
          <button
            type="button"
            onClick={() => onAccept(line)}
            className="min-h-11 flex-1 rounded-[10px] border border-[color:var(--scl-pink)] bg-[color:var(--scl-pink)] px-4 text-sm font-semibold text-[color:var(--scl-pink-ink)] transition-colors hover:bg-[color:var(--scl-pink-deep)]"
          >
            Accept Updated Odds{" "}
            {line.updatedOddsAmerican != null
              ? formatOdds(line.updatedOddsAmerican)
              : ""}
          </button>
        ) : null}
        {onRemove ? (
          <button
            type="button"
            onClick={() => onRemove(line)}
            className="border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 min-h-11 flex-1 rounded-[10px] border px-4 text-sm font-semibold transition-colors"
          >
            Remove leg
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Ticket-adjacent odds-movement prompt (M5 §3.2). Pink conviction CTAs; no blur/glass/gold.
 * Supports multi-line accept / remove / cancel for bulk singles.
 */
export function LineMovedPrompt({
  lines,
  mode = "confirm",
  onAcceptAll,
  onRemoveLeg,
  onCancel,
  className,
}: {
  lines: MovedLinePayload[];
  /** confirm = changed lines needing accept; blocked = unavailable only. */
  mode?: "confirm" | "blocked";
  onAcceptAll?: (accepted: MovedLinePayload[]) => void;
  onRemoveLeg?: (line: MovedLinePayload) => void;
  onCancel: () => void;
  className?: string;
}) {
  const title =
    mode === "blocked"
      ? "Line unavailable — review before submit"
      : "Line moved — review before submit";

  const confirmable = lines.filter((l) => l.class === "changed");

  return (
    <div
      role="alertdialog"
      aria-labelledby="line-moved-title"
      aria-describedby="line-moved-desc"
      className={cn(
        "space-y-4 rounded-[14px] border border-[color:var(--scl-pink-deep)] bg-[color:var(--scl-ink-700)] p-4 shadow-[var(--scl-shadow-card)]",
        className,
      )}
    >
      <div className="space-y-1">
        <p
          id="line-moved-title"
          className="scl-display text-foreground text-base font-bold tracking-[0.04em] uppercase"
        >
          {title}
        </p>
        <p id="line-moved-desc" className="text-muted-foreground text-xs">
          {mode === "blocked"
            ? "A selected line is no longer offered. Remove it to submit the rest, or cancel — nothing has been written yet for pending lines."
            : "Live odds changed beyond tolerance. Accept updated prices, remove a leg, or cancel — nothing has been written yet."}
        </p>
      </div>

      <div className="space-y-3">
        {lines.map((line) => (
          <LineCard
            key={line.moveKey}
            line={line}
            onAccept={
              mode === "confirm" && onAcceptAll
                ? (l) => onAcceptAll([l])
                : undefined
            }
            onRemove={onRemoveLeg}
          />
        ))}
      </div>

      {mode === "confirm" && confirmable.length > 1 && onAcceptAll ? (
        <button
          type="button"
          onClick={() => onAcceptAll(confirmable)}
          className="min-h-11 w-full rounded-[10px] border border-[color:var(--scl-pink)] bg-[color:var(--scl-pink)] px-4 text-sm font-semibold text-[color:var(--scl-pink-ink)] transition-colors hover:bg-[color:var(--scl-pink-deep)]"
        >
          Accept All Updated Odds
        </button>
      ) : null}

      <button
        type="button"
        onClick={onCancel}
        className="border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 min-h-11 w-full rounded-[10px] border px-4 text-sm font-semibold transition-colors"
      >
        Cancel submission
      </button>
    </div>
  );
}
