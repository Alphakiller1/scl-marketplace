"use client";

import type { ReactNode } from "react";

import { ProofReceipt } from "@/components/scl/proof-receipt";
import type { ProofReceiptState } from "@/lib/proof-receipt";

/** @deprecated Prefer ProofReceiptState — kept for PickCard / feed callers. */
export type TicketStatus = "verified" | "win" | "loss" | "muted" | "pending";

export type TicketProps = {
  selectionTitle: string;
  leadingMark?: ReactNode;
  eventLine?: string | React.ReactNode | null;
  legs: number;
  odds: string;
  stake: string;
  toWin: string;
  capturedAt?: string | null;
  book?: string | null;
  gradingHealthy?: boolean;
  status?: TicketStatus;
  settling?: boolean;
  className?: string;
  footerAction?: ReactNode;
  analysis?: string | null;
  closingOddsAmerican?: number | null;
  clvPts?: number | null;
  evidenceId?: string | null;
};

function ticketStatusToProofState(status: TicketStatus): ProofReceiptState {
  if (status === "win") return "won";
  if (status === "loss") return "loss";
  if (status === "verified") return "captured";
  if (status === "pending") return "pending";
  return "pending";
}

/**
 * Compatibility shim — canonical surface is ProofReceipt (`density="feed"`).
 */
export function Ticket({
  selectionTitle,
  leadingMark,
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
  closingOddsAmerican,
  clvPts,
  evidenceId,
}: TicketProps) {
  return (
    <ProofReceipt
      selectionTitle={selectionTitle}
      leadingMark={leadingMark}
      eventLine={eventLine}
      legs={legs}
      odds={odds}
      stake={stake}
      toWin={toWin}
      capturedAt={capturedAt}
      book={book}
      gradingHealthy={gradingHealthy}
      state={settling ? "capturing" : ticketStatusToProofState(status)}
      density="feed"
      closingOddsAmerican={closingOddsAmerican}
      clvPts={clvPts}
      evidenceId={evidenceId}
      settling={settling}
      className={className}
      footerAction={footerAction}
      analysis={analysis}
    />
  );
}
