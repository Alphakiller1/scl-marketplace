"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { BetSlip } from "@/components/scl/bet-slip";
import { GamePicker } from "@/components/scl/game-picker";
import { MobileSlipDock } from "@/components/scl/mobile-slip-dock";
import { ReceiptStack } from "@/components/scl/receipt-stack";
import { SlipModeToggle } from "@/components/scl/slip-mode-toggle";
import { SlipStoreProvider, useSlipStore } from "@/components/scl/slip-store";
import { VerificationReceipt } from "@/components/scl/verification-receipt";
import { createParlay } from "@/lib/actions/parlay.action";
import { createPlay, createPlays } from "@/lib/actions/play.action";
import type { SportKey } from "@/lib/constants";
import { formatOdds } from "@/lib/format";
import {
  americanToDecimal,
  combineDecimalOdds,
  decimalToAmerican,
} from "@/lib/odds";
import { toSlipLeg, type SlipMode } from "@/lib/slip";
import { useIsLg } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import type { BulkSinglesReceipt, SubmissionReceipt } from "@/lib/verification";

/**
 * Unified board + slip entry (M5 PR-3 / PR-4).
 * One GamePicker; multi-select into SlipStore; Singles | Parlay decided in-slip.
 */
export function UnifiedPickEntry({ initialMode }: { initialMode: SlipMode }) {
  return (
    <SlipStoreProvider initialMode={initialMode}>
      <UnifiedPickEntryInner />
    </SlipStoreProvider>
  );
}

/**
 * Picks are no longer attributed to a package at entry — `packageIds` stays on
 * the server contract but is always empty until the capper opt-in flow lands.
 */
function selectionToPlayInput(
  s: ReturnType<typeof useSlipStore>["selections"][number],
  notes?: string,
  notesPublic = true,
  packageIds: string[] = [],
) {
  return {
    sport: s.sport as SportKey,
    league: s.league,
    market: s.market,
    selection: s.selection,
    oddsAmerican: s.oddsAmerican,
    units: s.units,
    notes: notes?.trim() || undefined,
    notesPublic,
    packageIds,
    eventId: s.eventId,
    eventLabel: s.eventLabel,
    eventStartsAt: s.eventStartsAt,
    side: s.side,
    line: s.line,
    player: s.player,
    book: s.book,
  };
}

function UnifiedPickEntryInner() {
  const {
    mode,
    setMode,
    selections,
    parlayUnits,
    selectedKeys,
    addPick,
    clearSlip,
  } = useSlipStore();
  const isLg = useIsLg();
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const selectionFlowRef = useRef<HTMLDivElement>(null);

  function makeAnotherSelection() {
    setReceipt(null);
    window.requestAnimationFrame(() => {
      const selectionFlow = selectionFlowRef.current;
      if (!selectionFlow) return;
      selectionFlow.focus({ preventScroll: true });
      selectionFlow.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    });
  }

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

  async function handleBulkSuccess(bulk: BulkSinglesReceipt) {
    clearSlip();
    if (bulk.failedCount > 0) {
      toast.message(bulk.summaryLine);
    }
    setReceipt(bulk);
  }

  async function submitSelections() {
    setSubmitting(true);
    try {
      if (mode === "singles") {
        if (selections.length === 0) return;

        if (selections.length === 1) {
          const res = await createPlay(
            selectionToPlayInput(
              selections[0]!,
              selections[0]!.notes,
              selections[0]!.notesPublic,
            ),
          );
          if (res.ok) {
            clearSlip();
            setReceipt(res.receipt);
            return;
          }
          toast.error(res.error);
          return;
        }

        const res = await createPlays(
          selections.map((s) =>
            selectionToPlayInput(s, s.notes, s.notesPublic),
          ),
        );
        if (res.ok) {
          await handleBulkSuccess(res.receipt);
          return;
        }
        toast.error(res.error);
        return;
      }

      // Parlay — all-or-nothing
      if (selections.length < 2) return;
      const res = await createParlay({
        units: parlayUnits,
        packageIds: [],
        legs: selections.map((s) => toSlipLeg(s)),
      });
      if (res.ok) {
        clearSlip();
        setReceipt(res.receipt);
        return;
      }
      toast.error(res.error);
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmit() {
    await submitSelections();
  }

  if (receipt) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <div className="space-y-1">
          <p className="scl-eyebrow text-[color:var(--scl-muted-data)]">
            Pick Submitted
          </p>
          <div className="scl-section-mark">
            <h1 className="scl-display text-2xl leading-tight font-semibold tracking-[0.04em]">
              Proof Receipt
            </h1>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Your pick is now an inspectable record — odds captured and
              board-checked when verified.
            </p>
          </div>
        </div>
        {receipt.kind === "bulk" ? (
          <ReceiptStack
            receipt={receipt}
            onMakeAnotherSelection={makeAnotherSelection}
          />
        ) : (
          <VerificationReceipt
            receipt={receipt}
            onMakeAnotherSelection={makeAnotherSelection}
          />
        )}
      </div>
    );
  }

  const slip = <BetSlip onSubmit={onSubmit} submitting={submitting} />;

  const hasSelections = selections.length > 0;

  return (
    <div
      ref={selectionFlowRef}
      tabIndex={-1}
      className="mx-auto max-w-xl scroll-mt-24 space-y-5 outline-none lg:max-w-5xl"
    >
      <header>
        <p className="scl-eyebrow mb-1 text-[color:var(--scl-muted-data)]">
          Board Record Entry
        </p>
        <div className="scl-section-mark">
          <h1 className="scl-display text-2xl leading-tight font-semibold tracking-[0.04em] sm:text-3xl">
            Log A Pick
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
            Open a matchup and capture the best available pre-game price into
            your public record.
          </p>
        </div>
      </header>

      <div
        className={cn(
          "grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start",
        )}
      >
        <div className="min-w-0 space-y-4">
          {/*
            Mobile only: the slip lives in a dock that does not exist until
            something is in it, so on a phone this control was unreachable until
            after the picking was done — exactly backwards for deciding whether
            you are building a parlay. Desktop keeps the slip in view throughout
            and already has it. Both read the same store, so switching here and
            switching in the slip are the same action.
          */}
          {isLg === false ? (
            <div className="space-y-1.5 lg:hidden">
              <p className="scl-eyebrow text-[color:var(--scl-muted-data)]">
                Bet type
              </p>
              <SlipModeToggle mode={mode} onChange={setMode} />
            </div>
          ) : null}
          <GamePicker onPick={addPick} selectedKeys={selectedKeys} />
        </div>

        {isLg ? (
          <div className="min-w-0 lg:sticky lg:top-20">{slip}</div>
        ) : null}
      </div>

      {hasSelections && isLg === false ? (
        <MobileSlipDock
          title="Pick slip"
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
