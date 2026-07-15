"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { BetSlip } from "@/components/scl/bet-slip";
import { GamePicker } from "@/components/scl/game-picker";
import { MobileSlipDock } from "@/components/scl/mobile-slip-dock";
import { SectionHeader } from "@/components/scl/section";
import { SlipStoreProvider, useSlipStore } from "@/components/scl/slip-store";
import { VerificationReceipt } from "@/components/scl/verification-receipt";
import {
  createParlay,
  type AcceptedMove,
  type MovedLinePayload,
} from "@/lib/actions/parlay.action";
import { createPlay } from "@/lib/actions/play.action";
import { formatOdds } from "@/lib/format";
import type { SportKey } from "@/lib/constants";
import {
  americanToDecimal,
  combineDecimalOdds,
  decimalToAmerican,
} from "@/lib/odds";
import type { SlipMode } from "@/lib/slip";
import { toSlipLeg } from "@/lib/slip";
import { useIsLg } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import type { SubmissionReceipt } from "@/lib/verification";

/**
 * Unified board + slip entry (M5 PR-3).
 * One GamePicker; multi-select into SlipStore; Singles | Parlay decided in-slip.
 */
export function UnifiedPickEntry({ initialMode }: { initialMode: SlipMode }) {
  return (
    <SlipStoreProvider initialMode={initialMode}>
      <UnifiedPickEntryInner />
    </SlipStoreProvider>
  );
}

function UnifiedPickEntryInner() {
  const { mode, selections, parlayUnits, selectedKeys, addPick, clearSlip } =
    useSlipStore();
  const isLg = useIsLg();
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);
  const [movedLines, setMovedLines] = useState<MovedLinePayload[] | null>(null);
  const [unavailableLines, setUnavailableLines] = useState<
    MovedLinePayload[] | null
  >(null);
  const [acceptedSoFar, setAcceptedSoFar] = useState<AcceptedMove[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const dockOdds = useMemo(() => {
    if (selections.length === 0) return null;
    if (mode === "singles" && selections.length === 1) {
      return formatOdds(selections[0]!.oddsAmerican);
    }
    if (mode === "parlay" && selections.length >= 2) {
      const priced = selections.map((s) => s.oddsAmerican);
      return formatOdds(
        decimalToAmerican(combineDecimalOdds(priced.map(americanToDecimal))),
      );
    }
    return null;
  }, [mode, selections]);

  async function handlePlayResult(
    res:
      | { ok: true; receipt: SubmissionReceipt }
      | { ok: false; error: string }
      | { ok: false; needsConfirm: MovedLinePayload[] }
      | { ok: false; unavailable: MovedLinePayload[] },
  ) {
    if (res.ok) {
      setMovedLines(null);
      setUnavailableLines(null);
      setAcceptedSoFar([]);
      clearSlip();
      setReceipt(res.receipt);
      return;
    }
    if ("needsConfirm" in res && res.needsConfirm) {
      setUnavailableLines(null);
      setMovedLines(res.needsConfirm);
      return;
    }
    if ("unavailable" in res && res.unavailable) {
      setMovedLines(null);
      setAcceptedSoFar([]);
      setUnavailableLines(res.unavailable);
      return;
    }
    if ("error" in res) toast.error(res.error);
  }

  async function submitWithMoves(acceptedMoves?: AcceptedMove[]) {
    setSubmitting(true);
    try {
      if (mode === "singles") {
        if (selections.length !== 1) return;
        const s = selections[0]!;
        const res = await createPlay(
          {
            sport: s.sport as SportKey,
            league: undefined,
            market: s.market,
            selection: s.selection,
            oddsAmerican: s.oddsAmerican,
            units: s.units,
            notes: undefined,
            eventId: s.eventId,
            eventStartsAt: s.eventStartsAt,
            side: s.side,
            line: s.line,
            player: s.player,
            book: s.book,
          },
          acceptedMoves,
        );
        await handlePlayResult(res);
        return;
      }

      // Parlay
      if (selections.length < 2) return;
      const res = await createParlay(
        {
          units: parlayUnits,
          legs: selections.map((s) => toSlipLeg(s)),
        },
        acceptedMoves,
      );
      await handlePlayResult(res);
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmit() {
    setAcceptedSoFar([]);
    await submitWithMoves();
  }

  async function onAcceptMoved(lines: MovedLinePayload[]) {
    const incoming: AcceptedMove[] = lines
      .filter((l) => l.updatedOddsAmerican != null)
      .map((l) => ({
        moveKey: l.moveKey,
        selectedOddsAmerican: l.selectedOddsAmerican,
        acceptedOddsAmerican: l.updatedOddsAmerican as number,
      }));
    const merged = [
      ...acceptedSoFar.filter(
        (a) => !incoming.some((b) => b.moveKey === a.moveKey),
      ),
      ...incoming,
    ];
    setAcceptedSoFar(merged);
    await submitWithMoves(merged);
  }

  if (receipt) {
    return (
      <div className="mx-auto max-w-xl space-y-5">
        <SectionHeader
          title={receipt.kind === "parlay" ? "Parlay Logged" : "Play Logged"}
          subtitle="Confirmation for your record"
        />
        <VerificationReceipt receipt={receipt} />
      </div>
    );
  }

  const slip = (
    <BetSlip
      onSubmit={onSubmit}
      submitting={submitting}
      movedLines={movedLines}
      unavailableLines={unavailableLines}
      onAcceptMoved={onAcceptMoved}
      onCancelMoved={() => {
        setMovedLines(null);
        setAcceptedSoFar([]);
      }}
      onDismissUnavailable={() => setUnavailableLines(null)}
    />
  );

  const hasSelections = selections.length > 0;

  return (
    <div className="mx-auto max-w-xl space-y-5 lg:max-w-5xl">
      <div>
        <p className="scl-eyebrow mb-1 text-[color:var(--scl-muted-label)]">
          Verified Board Entry
        </p>
        <SectionHeader
          title="Submit A Play"
          subtitle="Tap lines into one slip — Singles or Parlay, without leaving the board"
        />
      </div>

      {!hasSelections ? (
        <div className="lg:max-w-sm">
          <BetSlip onSubmit={onSubmit} submitting={submitting} />
        </div>
      ) : null}

      <div
        className={cn(
          "grid gap-5 lg:items-start",
          hasSelections && "lg:grid-cols-[minmax(0,1fr)_22rem]",
        )}
      >
        <div className="min-w-0">
          <GamePicker onPick={addPick} selectedKeys={selectedKeys} />
        </div>

        {hasSelections && isLg ? (
          <div className="min-w-0 lg:sticky lg:top-20">{slip}</div>
        ) : null}
      </div>

      {hasSelections && isLg === false ? (
        <MobileSlipDock
          title="Bet slip"
          countLabel={
            mode === "parlay"
              ? `${selections.length} Leg${selections.length === 1 ? "" : "s"}`
              : `${selections.length} Pick${selections.length === 1 ? "" : "s"}`
          }
          oddsLabel={dockOdds}
        >
          {slip}
        </MobileSlipDock>
      ) : null}
    </div>
  );
}
