"use client";

import type { ReactNode } from "react";

import { BettingTitle } from "@/components/scl/betting-title";
import { formatOddsCaptureSourceLine } from "@/lib/books";
import {
  formatClvPts,
  formatClosingLine,
  formatEvidenceId,
  isSettledProofState,
  proofReceiptTextSummary,
  proofStampLabel,
  proofStampTone,
  type ProofReceiptDensity,
  type ProofReceiptState,
} from "@/lib/proof-receipt";
import { cn } from "@/lib/utils";

export type ProofReceiptProps = {
  selectionTitle: string;
  leadingMark?: ReactNode;
  eventLine?: string | React.ReactNode | null;
  legs?: number;
  odds: string;
  stake: string;
  toWin: string;
  capturedAt?: string | null;
  book?: string | null;
  gradingHealthy?: boolean;
  state: ProofReceiptState;
  density?: ProofReceiptDensity;
  /** Closing American odds — null → em-dash. */
  closingOddsAmerican?: number | null;
  /** CLV pts — null → em-dash. */
  clvPts?: number | null;
  /** Play id for Evidence ID. */
  evidenceId?: string | null;
  /** Hero settling sequence — capture fades in, then stamp drops. */
  settling?: boolean;
  className?: string;
  footerAction?: ReactNode;
  analysis?: string | null;
  /** Extra status / grading copy under capture (post-submit). */
  statusNote?: string | null;
};

const STAMP_CLASS: Record<ReturnType<typeof proofStampTone>, string> = {
  pink: "border-pink text-pink",
  win: "border-[color:var(--scl-win)] text-[color:var(--scl-win)]",
  loss: "border-[color:var(--scl-loss)] text-[color:var(--scl-loss)]",
  push: "border-[color:var(--scl-push)] text-[color:var(--scl-push)]",
  muted: "border-border text-muted-foreground",
};

/**
 * Canonical Proof Receipt — tear line, pink VERIFIED stamp, honest CLV/close.
 * Densities: feed | expanded-paper | mobile | share-image | text-only.
 */
export function ProofReceipt({
  selectionTitle,
  leadingMark,
  eventLine,
  legs = 1,
  odds,
  stake,
  toWin,
  capturedAt,
  book,
  gradingHealthy,
  state,
  density = "feed",
  closingOddsAmerican = null,
  clvPts = null,
  evidenceId = null,
  settling = false,
  className,
  footerAction,
  analysis,
  statusNote,
}: ProofReceiptProps) {
  const tone = proofStampTone(state);
  const stamp = proofStampLabel(state);
  const settled = isSettledProofState(state);
  const closingLine = formatClosingLine(closingOddsAmerican);
  const clv = formatClvPts(clvPts);
  const evidence = formatEvidenceId(evidenceId);
  const captureLine = formatOddsCaptureSourceLine({
    capturedAt,
    book,
    gradingHealthy: settled ? true : gradingHealthy,
  });
  const gradeDelayed = !settled && captureLine.includes("GRADING DELAYED");
  const paper = density === "expanded-paper" || density === "share-image";
  const compact = density === "mobile";
  const showProofMeta = density !== "feed" || evidenceId != null;

  if (density === "text-only") {
    const text = proofReceiptTextSummary({
      selection: selectionTitle,
      eventLine: typeof eventLine === "string" ? eventLine : null,
      odds,
      stake,
      state,
      closingLine,
      clv,
      evidenceId: evidence,
    });
    return (
      <p
        className={cn("scl-data text-muted-foreground text-sm", className)}
        data-density="text-only"
      >
        {text}
      </p>
    );
  }

  return (
    <article
      className={cn(
        "bg-card border-border relative overflow-hidden rounded-[var(--scl-radius-card)] border shadow-[var(--scl-shadow-card)]",
        paper && "scl-proof-paper",
        settling && "scl-ticket-settling",
        compact && "rounded-[12px]",
        density === "share-image" && "max-w-md",
        className,
      )}
      data-density={density}
      data-state={state}
      aria-label={`Proof receipt: ${selectionTitle}. ${stamp}. Evidence ${evidenceId || "unavailable"}`}
    >
      <div
        className={cn(
          "border-border relative border-b border-dashed",
          compact ? "px-4 pt-3.5 pb-3" : "px-5 pt-[18px] pb-3.5",
        )}
      >
        <div
          className={cn(
            "scl-display scl-ticket-stamp absolute origin-center rounded-md border-2 px-2.5 py-1 text-[0.8rem] font-bold tracking-[0.16em] uppercase",
            compact ? "top-3 right-3" : "top-4 right-4",
            STAMP_CLASS[tone],
            settling ? "rotate-12 opacity-0" : "rotate-6 opacity-100",
          )}
          aria-hidden={settling ? true : undefined}
        >
          {stamp}
        </div>

        <p className="scl-eyebrow mb-1.5 pr-24 text-[color:var(--scl-muted-label)]">
          SCL · Pick Receipt
        </p>
        <div className="flex min-w-0 items-start gap-2.5 pr-20">
          {leadingMark ? (
            <span className="mt-1 shrink-0">{leadingMark}</span>
          ) : null}
          <BettingTitle
            as="h2"
            text={selectionTitle}
            className={cn(
              "scl-display text-foreground min-w-0 flex-1 font-bold tracking-tight text-balance whitespace-pre-line",
              compact
                ? "text-xl leading-[1.1]"
                : "text-2xl leading-[1.05] sm:text-[1.65rem]",
            )}
          />
        </div>
        {eventLine ? (
          <div className="scl-data text-muted-foreground mt-1.5 text-[0.65rem] tracking-[0.06em] uppercase">
            {eventLine}
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          "grid gap-2.5",
          compact ? "grid-cols-3 px-4 py-3" : "grid-cols-3 px-5 py-3.5",
        )}
      >
        <ProofCell label="Legs" value={String(legs)} />
        <ProofCell label="Odds" value={odds} accent />
        <ProofCell label="Stake" value={stake} />
      </div>

      {showProofMeta ? (
        <div
          className={cn(
            "border-border grid gap-2 border-t border-dashed",
            compact
              ? "grid-cols-2 px-4 py-2.5"
              : "grid-cols-2 px-5 py-3 sm:grid-cols-3",
          )}
        >
          <ProofCell label="Close" value={closingLine} />
          <ProofCell label="CLV" value={clv} />
          <ProofCell
            label="Evidence"
            value={evidence}
            title={evidenceId || undefined}
            className="col-span-2 sm:col-span-1"
          />
        </div>
      ) : null}

      <div
        className="border-border relative mx-[-1px] border-t-[1.5px] border-dashed"
        aria-hidden
      >
        <span className="bg-background border-border absolute top-[-9px] left-[-10px] size-[18px] rounded-full border" />
        <span className="bg-background border-border absolute top-[-9px] right-[-10px] size-[18px] rounded-full border" />
      </div>

      <div
        className={cn(
          "flex items-center justify-between gap-3",
          compact ? "px-4 pt-2.5 pb-3" : "px-5 pt-3 pb-4",
        )}
      >
        <p
          className={cn(
            "scl-data scl-ticket-capture text-muted-foreground max-w-[16rem] text-[0.625rem] leading-relaxed tracking-[0.08em] uppercase",
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

      {statusNote ? (
        <div className="border-border border-t px-5 py-2.5">
          <p className="text-muted-foreground text-sm">{statusNote}</p>
        </div>
      ) : null}

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

      {footerAction && density !== "share-image" ? (
        <div className="border-border border-t px-5 py-3">{footerAction}</div>
      ) : null}
    </article>
  );
}

function ProofCell({
  label,
  value,
  accent,
  title,
  className,
}: {
  label: string;
  value: string;
  accent?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <div className={className} title={title}>
      <div className="scl-eyebrow text-muted-foreground">{label}</div>
      <div
        className={cn(
          "scl-data mt-0.5 text-base font-semibold tabular-nums",
          accent ? "text-pink" : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}
