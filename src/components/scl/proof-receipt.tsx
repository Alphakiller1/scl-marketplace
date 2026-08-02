"use client";

import type { ReactNode } from "react";

import { BettingTitle } from "@/components/scl/betting-title";
import { BookMark } from "@/components/scl/book-mark";
import {
  bookLabel,
  formatOddsCaptureSourceLine,
  isBookKey,
  oddsSourceBoardLabel,
} from "@/lib/books";
import {
  formatClvPts,
  formatClosingLine,
  formatEvidenceId,
  isSettledProofState,
  missingCloseOrClvTooltip,
  proofReceiptTextSummary,
  proofStampLabel,
  proofStampTone,
  proofUnitsLabel,
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
  /**
   * When true and the pick is board-verified, pink VERIFIED stays the dominant
   * stamp even after settlement — result renders as a secondary settlement mark.
   */
  verificationDominant?: boolean;
  /** Board-verified (VERIFIED / AUTO_VERIFIED). Required for verificationDominant. */
  boardVerified?: boolean;
  /** Closing American odds — null → em-dash. */
  closingOddsAmerican?: number | null;
  /** CLV pts — null → em-dash. */
  clvPts?: number | null;
  /** Play id for Evidence ID. */
  evidenceId?: string | null;
  /** Scheduled start — drives empty Close/CLV tooltip honesty. */
  eventStartsAt?: Date | string | null;
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
  win: "border-[color:var(--scl-win)] text-[color:var(--scl-win-text)]",
  loss: "border-[color:var(--scl-loss)] text-[color:var(--scl-loss-text)]",
  push: "border-[color:var(--scl-push)] text-[color:var(--scl-push-text)]",
  muted: "border-border text-muted-foreground",
};

/** Strip SOURCE: … from capture line once the logo + board label carry it. */
function captureLineWithoutSource(line: string): string {
  return line
    .replace(/\s*\/\s*SOURCE:\s*[^\u00b7]+/i, "")
    .replace(/\s*SOURCE:\s*[^\u00b7]+/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

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
  verificationDominant = false,
  boardVerified = false,
  closingOddsAmerican = null,
  clvPts = null,
  evidenceId = null,
  eventStartsAt = null,
  settling = false,
  className,
  footerAction,
  analysis,
  statusNote,
}: ProofReceiptProps) {
  const settled = isSettledProofState(state);
  const paper = density === "expanded-paper" || density === "share-image";
  const compact = density === "mobile";
  /** Pink VERIFIED is the dominant mark on expanded paper whenever board-verified. */
  const preferVerified =
    boardVerified && (verificationDominant || density === "expanded-paper");
  const tone = preferVerified ? "pink" : proofStampTone(state);
  const stamp = preferVerified ? "Verified" : proofStampLabel(state);
  const settlementLabel = preferVerified ? proofStampLabel(state) : null;
  const settlementTone = preferVerified ? proofStampTone(state) : null;
  const closingLine = formatClosingLine(closingOddsAmerican);
  const clv = formatClvPts(clvPts);
  /**
   * Short face for dense feed rows; paper/share show a longer wrap-safe id
   * so documentary Evidence never relies on ellipsis clip alone.
   */
  const evidence = (() => {
    if (!evidenceId?.trim()) return "—";
    if (paper) {
      const clean = evidenceId.trim().toUpperCase();
      if (clean.length <= 22) return clean;
      return `${clean.slice(0, 10)}…${clean.slice(-8)}`;
    }
    return formatEvidenceId(evidenceId);
  })();
  const emptyCloseClvTitle =
    closingLine === "—" || clv === "—"
      ? missingCloseOrClvTooltip(eventStartsAt)
      : undefined;
  const clvTitle = clv === "—" ? emptyCloseClvTitle : undefined;
  const captureLine = formatOddsCaptureSourceLine({
    capturedAt,
    book,
    gradingHealthy: settled ? true : gradingHealthy,
  });
  const gradeDelayed = !settled && captureLine.includes("GRADING DELAYED");
  const showProofMeta = density !== "feed" || evidenceId != null;
  const padX = compact || paper ? "px-3.5 sm:px-5" : "px-5";
  const sourceBoard = oddsSourceBoardLabel(book);
  const sourceName =
    book && isBookKey(book)
      ? bookLabel(book)
      : book?.trim()
        ? book.trim()
        : "Live Board";

  if (density === "text-only") {
    const text = proofReceiptTextSummary({
      selection: selectionTitle,
      eventLine: typeof eventLine === "string" ? eventLine : null,
      odds,
      stake,
      state,
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

  const showSettlementLine =
    Boolean(settlementLabel) &&
    settlementLabel !== "Verified" &&
    settlementLabel !== stamp;
  const unitsLabel = proofUnitsLabel(state);

  const captureBody = (() => {
    if (captureLine.includes("GRADES AUTOMATICALLY")) {
      const base = captureLineWithoutSource(
        captureLine.replace(/ · GRADES AUTOMATICALLY$/, ""),
      );
      return (
        <>
          {base}
          {base ? " · " : null}
          <span className="text-pos font-semibold">Grades Automatically</span>
        </>
      );
    }
    if (gradeDelayed) {
      const base = captureLineWithoutSource(
        captureLine.replace(/ · GRADING DELAYED — CHECK BACK SOON$/, ""),
      );
      return (
        <>
          {base}
          {base ? " · " : null}
          <span className="text-muted-foreground font-semibold">
            Grading delayed — check back soon
          </span>
        </>
      );
    }
    return captureLineWithoutSource(captureLine);
  })();

  return (
    <article
      className={cn(
        "bg-card border-border relative w-full max-w-full min-w-0 overflow-x-clip overflow-y-hidden rounded-[var(--scl-radius-card)] border shadow-[var(--scl-shadow-card)]",
        paper &&
          "scl-proof-paper rounded-[var(--scl-radius-receipt)] border-2 border-[color:var(--border)]",
        density === "share-image" && "aspect-[4/5]",
        settling && "scl-ticket-settling",
        compact && "rounded-[12px]",
        density === "share-image" && "max-w-md",
        className,
      )}
      data-density={density}
      data-state={state}
      aria-label={`Proof receipt: ${selectionTitle}. ${stamp}${showSettlementLine ? `, ${settlementLabel}` : ""}. Source ${sourceBoard}. Receipt ID ${evidenceId || "unavailable"}`}
    >
      <div
        className={cn(
          "border-border relative border-b border-dashed",
          compact ? "px-3.5 pt-3.5 pb-3 sm:px-4" : `${padX} pt-[18px] pb-3.5`,
        )}
      >
        <div
          className={cn(
            "scl-display scl-ticket-stamp absolute origin-center rounded-md border-2 px-2 py-0.5 text-[0.7rem] font-bold tracking-[0.14em] uppercase sm:px-2.5 sm:py-1 sm:text-[0.8rem] sm:tracking-[0.16em]",
            compact ? "top-3 right-3" : "top-3.5 right-3.5 sm:top-4 sm:right-4",
            STAMP_CLASS[tone],
            preferVerified &&
              "shadow-[0_0_0_1px_color-mix(in_oklab,var(--scl-pink)_35%,transparent)]",
            settling ? "rotate-12 opacity-0" : "rotate-6 opacity-100",
          )}
          aria-hidden={settling ? true : undefined}
        >
          {stamp}
        </div>

        <p className="scl-eyebrow mb-1.5 pr-20 text-[color:var(--scl-muted-label)] sm:pr-24">
          Sports Cappers Leaderboard
        </p>
        <div className="flex min-w-0 items-start gap-2.5 pr-16 sm:pr-20">
          {leadingMark ? (
            <span className="mt-1 shrink-0">{leadingMark}</span>
          ) : null}
          {/*
            Bet title uses UI + data fonts (same family stack as cell values),
            not condensed display — keeps the ticket face consistent.
          */}
          <BettingTitle
            as="h2"
            text={selectionTitle}
            className={cn(
              "text-foreground min-w-0 flex-1 font-[family-name:var(--scl-font-ui)] font-bold tracking-tight text-balance break-words whitespace-pre-line",
              compact
                ? "text-xl leading-[1.15]"
                : "text-xl leading-[1.15] sm:text-[1.35rem] sm:leading-[1.2] md:text-[1.5rem]",
            )}
          />
        </div>
        {eventLine ? (
          <div className="scl-data text-muted-foreground mt-1.5 text-[0.65rem] tracking-[0.06em] uppercase">
            {eventLine}
          </div>
        ) : null}
        {showSettlementLine ? (
          <p
            className={cn(
              "scl-data mt-2 inline-flex items-center rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-[0.1em] uppercase",
              settlementTone === "win" &&
                "border-[color:var(--scl-win)]/40 text-[color:var(--scl-win-text)]",
              settlementTone === "loss" &&
                "border-[color:var(--scl-loss)]/40 text-[color:var(--scl-loss-text)]",
              settlementTone === "push" &&
                "border-[color:var(--scl-push)]/40 text-[color:var(--scl-push-text)]",
              (!settlementTone ||
                settlementTone === "muted" ||
                settlementTone === "pink") &&
                "border-border text-muted-foreground",
            )}
          >
            Result · {settlementLabel}
          </p>
        ) : null}
      </div>

      <div
        className={cn(
          "grid min-w-0 gap-2.5",
          compact
            ? "grid-cols-3 px-3.5 py-3 sm:px-4"
            : `grid-cols-3 ${padX} py-3.5`,
        )}
      >
        <ProofCell label="Legs" value={String(legs)} />
        <ProofCell label="Odds" value={odds} accent />
        <ProofCell label="Stake" value={stake} />
      </div>

      {showProofMeta ? (
        <div
          className={cn(
            "border-border grid min-w-0 gap-2 border-t border-dashed",
            compact
              ? "grid-cols-2 px-3.5 py-2.5 sm:px-4"
              : `grid-cols-2 ${padX} py-3`,
          )}
        >
          <ProofCell label="CLV" value={clv} title={clvTitle} />
          <ProofCell
            label="Receipt ID"
            value={evidence}
            title={evidenceId || undefined}
            wrap
            className="min-w-0"
          />
        </div>
      ) : null}

      {/*
        Tear notches stay inside the receipt width: circles are centered on the
        edge but painted only within this overflow-clipped strip so they never
        expand scrollWidth (~9px) past the client on mobile.
      */}
      <div
        className="border-border relative overflow-x-clip border-t-[1.5px] border-dashed"
        aria-hidden
      >
        <span className="pointer-events-none absolute top-[-9px] left-0 size-[18px] -translate-x-1/2 rounded-full border border-[color:var(--border)] bg-[color:var(--scl-ink-900,#0b0f14)]" />
        <span className="pointer-events-none absolute top-[-9px] right-0 size-[18px] translate-x-1/2 rounded-full border border-[color:var(--border)] bg-[color:var(--scl-ink-900,#0b0f14)]" />
      </div>

      <div
        className={cn(
          "flex min-w-0 items-start justify-between gap-3",
          compact ? "px-3.5 pt-2.5 pb-3 sm:px-4" : `${padX} pt-3 pb-4`,
        )}
      >
        <div
          className={cn(
            "scl-ticket-capture flex min-w-0 flex-1 items-start gap-2.5",
            settling && "opacity-0",
          )}
        >
          <span
            className={cn(
              "mt-0.5 inline-flex shrink-0 items-center justify-center rounded-[5px] border border-[color:var(--border)] bg-[color:color-mix(in_srgb,#fff_55%,transparent)] p-1",
              paper ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]" : null,
            )}
            title={sourceName}
          >
            <BookMark bookKey={book} size={compact ? 16 : 20} />
          </span>
          <div className="min-w-0">
            <p className="scl-eyebrow text-[color:var(--scl-muted-label)]">
              Source
            </p>
            <p className="scl-data text-foreground text-sm font-semibold tracking-tight">
              {sourceBoard}
            </p>
            <p className="scl-data text-muted-foreground mt-1 max-w-[18rem] text-[0.625rem] leading-relaxed tracking-[0.08em] uppercase">
              {captureBody}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className="scl-eyebrow text-muted-foreground block">
            {unitsLabel}
          </span>
          <span className="scl-data text-foreground text-[0.95rem] font-semibold tracking-normal tabular-nums">
            {toWin}
          </span>
        </div>
      </div>

      {statusNote ? (
        <div className={cn("border-border border-t py-2.5", padX)}>
          <p className="text-muted-foreground text-sm">{statusNote}</p>
        </div>
      ) : null}

      {analysis ? (
        <div className={cn("border-border border-t py-3", padX)}>
          <p className="text-muted-foreground text-[0.65rem] font-semibold tracking-wide uppercase">
            Analysis
          </p>
          <p className="text-foreground mt-1 line-clamp-4 text-sm leading-relaxed">
            {analysis}
          </p>
        </div>
      ) : null}

      {footerAction && density !== "share-image" ? (
        <div className={cn("border-border border-t py-3", padX)}>
          {footerAction}
        </div>
      ) : null}
    </article>
  );
}

function ProofCell({
  label,
  value,
  accent: _accent,
  title,
  className,
  wrap = false,
}: {
  label: string;
  value: string;
  /** @deprecated Accent numerals no longer use pink text (AA). Kept for call-site compat. */
  accent?: boolean;
  title?: string;
  className?: string;
  /** Allow one soft wrap (Evidence ID) instead of ellipsis clip. */
  wrap?: boolean;
}) {
  void _accent;
  return (
    <div className={className} title={title}>
      <div className="scl-eyebrow">{label}</div>
      <div
        className={cn(
          "scl-data text-foreground mt-0.5 text-base font-semibold tabular-nums",
          wrap
            ? "line-clamp-2 max-w-full [overflow-wrap:anywhere] break-all whitespace-normal"
            : "truncate",
        )}
      >
        {value}
      </div>
    </div>
  );
}
