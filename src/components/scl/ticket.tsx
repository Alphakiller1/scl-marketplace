"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type TicketStatus = "verified" | "win" | "loss" | "muted" | "pending";

export type TicketProps = {
  selectionTitle: string;
  eventLine?: string | null;
  legs: number;
  odds: string;
  stake: string;
  toWin: string;
  capturedAt?: string | null;
  status?: TicketStatus;
  /** Hero settling sequence — capture fades in, then stamp drops (CSS; reduced-motion safe). */
  settling?: boolean;
  className?: string;
  footerAction?: ReactNode;
};

function stampLabel(status: TicketStatus): string {
  if (status === "win") return "Win";
  if (status === "loss") return "Loss";
  if (status === "muted") return "Logged";
  if (status === "pending") return "Pending";
  return "Verified";
}

function formatCaptureLine(capturedAt?: string | null): string {
  if (!capturedAt) return "ODDS CAPTURED · SOURCE: LIVE BOARD";
  const date = new Date(capturedAt);
  if (Number.isNaN(date.getTime())) return "ODDS CAPTURED · SOURCE: LIVE BOARD";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const stamp = `${get("month")}·${get("day")}·${get("year")} ${get("hour")}:${get("minute")}:${get("second")} ET`;
  return `ODDS CAPTURED ${stamp}`;
}

/**
 * Signature bet-ticket card — perforated tear, gold stamp, mono capture line.
 * Reference: scl-pick-flow-concept.html Exhibit B.
 */
export function Ticket({
  selectionTitle,
  eventLine,
  legs,
  odds,
  stake,
  toWin,
  capturedAt,
  status = "verified",
  settling = false,
  className,
  footerAction,
}: TicketProps) {
  const goldStamp = status === "verified" || status === "win";
  const lossStamp = status === "loss";

  return (
    <article
      className={cn(
        "bg-card border-border relative overflow-hidden rounded-[var(--scl-radius-card)] border shadow-[var(--scl-shadow-card)]",
        settling && "scl-ticket-settling",
        className,
      )}
      aria-label="Pick receipt"
    >
      <div className="border-border relative border-b border-dashed px-5 pt-[18px] pb-3.5">
        <div
          className={cn(
            "scl-display scl-ticket-stamp absolute top-4 right-4 origin-center rounded-md border-2 px-2.5 py-1 text-[0.8rem] font-bold tracking-[0.16em] uppercase",
            goldStamp && "border-gold text-gold",
            lossStamp && "border-neg text-neg",
            !goldStamp && !lossStamp && "border-border text-muted-foreground",
            settling ? "rotate-12 opacity-0" : "rotate-6 opacity-100",
          )}
          aria-hidden={settling ? true : undefined}
        >
          {stampLabel(status)}
        </div>

        <p className="scl-eyebrow mb-1.5 pr-24 text-[color:var(--scl-muted-label)]">
          SCL · Pick Receipt
        </p>
        <h2 className="scl-display text-foreground text-2xl leading-[1.05] font-bold tracking-tight text-balance whitespace-pre-line sm:text-[1.65rem]">
          {selectionTitle}
        </h2>
        {eventLine ? (
          <p className="scl-data text-muted-foreground mt-1.5 text-[0.65rem] tracking-[0.06em] uppercase">
            {eventLine}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2.5 px-5 py-3.5">
        <TicketCell label="Legs" value={String(legs)} />
        <TicketCell label="Odds" value={odds} gold />
        <TicketCell label="Stake" value={stake} />
      </div>

      <div
        className="border-border relative mx-[-1px] border-t-[1.5px] border-dashed"
        aria-hidden
      >
        <span className="bg-background border-border absolute top-[-9px] left-[-10px] size-[18px] rounded-full border" />
        <span className="bg-background border-border absolute top-[-9px] right-[-10px] size-[18px] rounded-full border" />
      </div>

      <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-4">
        <p
          className={cn(
            "scl-data scl-ticket-capture text-muted-foreground max-w-[14rem] text-[0.56rem] leading-[1.7] tracking-[0.1em] uppercase",
            settling && "opacity-0",
          )}
        >
          {formatCaptureLine(capturedAt)}
          <br />
          Source: Live Board ·{" "}
          <span className="text-pos font-semibold">Grades Automatically</span>
        </p>
        <div className="scl-display shrink-0 text-right text-[0.8rem] font-semibold tracking-[0.06em] uppercase">
          <span className="text-muted-foreground block">To Win</span>
          <span className="scl-data text-gold text-[0.95rem] font-semibold tracking-normal normal-case">
            {toWin}
          </span>
        </div>
      </div>

      {footerAction ? (
        <div className="border-border border-t px-5 py-3">{footerAction}</div>
      ) : null}
    </article>
  );
}

function TicketCell({
  label,
  value,
  gold,
}: {
  label: string;
  value: string;
  gold?: boolean;
}) {
  return (
    <div>
      <div className="scl-eyebrow text-muted-foreground">{label}</div>
      <div
        className={cn(
          "scl-data mt-0.5 text-base font-semibold",
          gold ? "text-gold" : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}
