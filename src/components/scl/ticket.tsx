"use client";

import type { ReactNode } from "react";

import { BettingTitle } from "@/components/scl/betting-title";
import { formatOddsCaptureSourceLine } from "@/lib/books";
import { cn } from "@/lib/utils";

export type TicketStatus = "verified" | "win" | "loss" | "muted" | "pending";

export type TicketProps = {
  selectionTitle: string;
  eventLine?: string | React.ReactNode | null;
  legs: number;
  odds: string;
  stake: string;
  toWin: string;
  capturedAt?: string | null;
  /** Odds API bookmaker key — surfaces SOURCE: <BOOK> BOARD (M5 §4). */
  book?: string | null;
  /** When false, do not promise automatic grading (cron unhealthy / delayed). */
  gradingHealthy?: boolean;
  status?: TicketStatus;
  /** Hero settling sequence — capture fades in, then stamp drops (CSS; reduced-motion safe). */
  settling?: boolean;
  className?: string;
  footerAction?: ReactNode;
  analysis?: string | null;
};

function stampLabel(status: TicketStatus): string {
  if (status === "win") return "Win";
  if (status === "loss") return "Loss";
  if (status === "muted") return "Logged";
  if (status === "pending") return "Pending";
  return "Verified";
}

/**
 * Signature bet-ticket card — perforated tear, pink stamp, mono capture line.
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
  book,
  gradingHealthy,
  status = "verified",
  settling = false,
  className,
  footerAction,
  analysis,
}: TicketProps) {
  const pinkStamp = status === "verified" || status === "win";
  const lossStamp = status === "loss";
  const captureLine = formatOddsCaptureSourceLine({
    capturedAt,
    book,
    gradingHealthy,
  });
  const gradeDelayed = captureLine.includes("GRADING DELAYED");

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
            pinkStamp && "border-pink text-pink",
            lossStamp && "border-neg text-neg",
            !pinkStamp && !lossStamp && "border-border text-muted-foreground",
            settling ? "rotate-12 opacity-0" : "rotate-6 opacity-100",
          )}
          aria-hidden={settling ? true : undefined}
        >
          {stampLabel(status)}
        </div>

        <p className="scl-eyebrow mb-1.5 pr-24 text-[color:var(--scl-muted-label)]">
          SCL · Pick Receipt
        </p>
        <BettingTitle
          as="h2"
          text={selectionTitle}
          className="scl-display text-foreground text-2xl leading-[1.05] font-bold tracking-tight text-balance whitespace-pre-line sm:text-[1.65rem]"
        />
        {eventLine ? (
          <p className="scl-data text-muted-foreground mt-1.5 text-[0.65rem] tracking-[0.06em] uppercase">
            {eventLine}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2.5 px-5 py-3.5">
        <TicketCell label="Legs" value={String(legs)} />
        <TicketCell label="Odds" value={odds} accent />
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
          {captureLine.split(" · GRADES AUTOMATICALLY").length === 2 ? (
            <>
              {captureLine.replace(/ · GRADES AUTOMATICALLY$/, "")}
              {" · "}
              <span className="text-pos font-semibold">
                Grades Automatically
              </span>
            </>
          ) : gradeDelayed ? (
            <>
              {captureLine.replace(/ · GRADING DELAYED — CHECK BACK SOON$/, "")}
              {" · "}
              <span className="text-muted-foreground font-semibold">
                Grading delayed — check back soon
              </span>
            </>
          ) : (
            captureLine
          )}
        </p>
        <div className="scl-display shrink-0 text-right text-[0.8rem] font-semibold tracking-[0.06em] uppercase">
          <span className="text-muted-foreground block">To Win</span>
          <span className="scl-data text-pink text-[0.95rem] font-semibold tracking-normal normal-case">
            {toWin}
          </span>
        </div>
      </div>

      {analysis ? (
        <div className="border-border border-t px-5 py-3">
          <p className="text-muted-foreground text-[0.65rem] font-semibold tracking-wide uppercase">
            Analysis
          </p>
          <p className="text-foreground mt-1 line-clamp-4 text-sm leading-relaxed">
            {analysis}
          </p>
        </div>
      ) : null}

      {footerAction ? (
        <div className="border-border border-t px-5 py-3">{footerAction}</div>
      ) : null}
    </article>
  );
}

function TicketCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="scl-eyebrow text-muted-foreground">{label}</div>
      <div
        className={cn(
          "scl-data mt-0.5 text-base font-semibold",
          accent ? "text-pink" : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}
