"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { BetSlip } from "@/components/scl/bet-slip";
import { GamePicker } from "@/components/scl/game-picker";
import { MobileSlipDock } from "@/components/scl/mobile-slip-dock";
import { ReceiptStack } from "@/components/scl/receipt-stack";
import { SectionHeader } from "@/components/scl/section";
import { SlipStoreProvider, useSlipStore } from "@/components/scl/slip-store";
import { VerificationReceipt } from "@/components/scl/verification-receipt";
import { Button } from "@/components/ui/button";
import { createParlay } from "@/lib/actions/parlay.action";
import {
  getPickPackageOptions,
  type PickPackageOption,
} from "@/lib/actions/package-options.action";
import { createPlay, createPlays } from "@/lib/actions/play.action";
import type { SportKey } from "@/lib/constants";
import { formatOdds } from "@/lib/format";
import {
  americanToDecimal,
  combineDecimalOdds,
  decimalToAmerican,
} from "@/lib/odds";
import { moveKey } from "@/lib/odds-movement";
import type { AcceptedMove, MovedLinePayload } from "@/lib/odds-movement";
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

function selectionMoveKey(
  s: ReturnType<typeof useSlipStore>["selections"][number],
) {
  return moveKey({
    eventId: s.eventId,
    market: s.market,
    side: s.side,
    line: s.line,
    player: s.player,
  });
}

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
    selections,
    parlayUnits,
    selectedKeys,
    addPick,
    clearSlip,
    removeSelection,
  } = useSlipStore();
  const isLg = useIsLg();
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);
  const [movedLines, setMovedLines] = useState<MovedLinePayload[] | null>(null);
  const [unavailableLines, setUnavailableLines] = useState<
    MovedLinePayload[] | null
  >(null);
  const [acceptedSoFar, setAcceptedSoFar] = useState<AcceptedMove[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [packageOptions, setPackageOptions] = useState<PickPackageOption[]>([]);
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    void getPickPackageOptions().then((options) => {
      if (active) setPackageOptions(options);
    });
    return () => {
      active = false;
    };
  }, []);

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

  function applyPromptState(opts: {
    needsConfirm?: MovedLinePayload[];
    unavailable?: MovedLinePayload[];
  }) {
    const confirm = opts.needsConfirm ?? [];
    const unavail = opts.unavailable ?? [];
    // Merge into one prompt list when both present (bulk).
    if (confirm.length && unavail.length) {
      setMovedLines([...confirm, ...unavail]);
      setUnavailableLines(null);
      return;
    }
    if (confirm.length) {
      setUnavailableLines(null);
      setMovedLines(confirm);
      return;
    }
    if (unavail.length) {
      setMovedLines(null);
      setUnavailableLines(unavail);
    }
  }

  async function handleBulkSuccess(bulk: BulkSinglesReceipt) {
    setMovedLines(null);
    setUnavailableLines(null);
    setAcceptedSoFar([]);
    const written = new Set(bulk.writtenMoveKeys);
    const failedKeys = new Set(
      bulk.failed.map((f) => f.moveKey).filter((k): k is string => Boolean(k)),
    );
    for (const s of selections) {
      const key = selectionMoveKey(s);
      if (written.has(key) || failedKeys.has(key)) removeSelection(s.id);
    }
    // Suspended stay in the slip; otherwise clear leftover rows.
    if (bulk.suspendedCount === 0) {
      clearSlip();
    }
    if (bulk.suspendedCount > 0 || bulk.failedCount > 0) {
      toast.message(bulk.summaryLine);
    }
    setReceipt(bulk);
  }

  async function submitWithMoves(acceptedMoves?: AcceptedMove[]) {
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
              selectedPackageIds,
            ),
            acceptedMoves,
          );
          if (res.ok) {
            setMovedLines(null);
            setUnavailableLines(null);
            setAcceptedSoFar([]);
            clearSlip();
            setReceipt(res.receipt);
            return;
          }
          if ("needsConfirm" in res && res.needsConfirm) {
            applyPromptState({ needsConfirm: res.needsConfirm });
            return;
          }
          if ("unavailable" in res && res.unavailable) {
            applyPromptState({ unavailable: res.unavailable });
            return;
          }
          if ("error" in res) toast.error(res.error);
          return;
        }

        const res = await createPlays(
          selections.map((s) =>
            selectionToPlayInput(s, s.notes, s.notesPublic, selectedPackageIds),
          ),
          acceptedMoves,
        );
        if (res.ok) {
          await handleBulkSuccess(res.receipt);
          return;
        }
        if ("needsConfirm" in res && res.needsConfirm) {
          applyPromptState({
            needsConfirm: res.needsConfirm,
            unavailable: res.unavailable,
          });
          return;
        }
        if ("unavailable" in res && res.unavailable) {
          applyPromptState({ unavailable: res.unavailable });
          return;
        }
        if ("error" in res) toast.error(res.error);
        return;
      }

      // Parlay — all-or-nothing
      if (selections.length < 2) return;
      const res = await createParlay(
        {
          units: parlayUnits,
          packageIds: selectedPackageIds,
          legs: selections.map((s) => toSlipLeg(s)),
        },
        acceptedMoves,
      );
      if (res.ok) {
        setMovedLines(null);
        setUnavailableLines(null);
        setAcceptedSoFar([]);
        clearSlip();
        setReceipt(res.receipt);
        return;
      }
      if ("needsConfirm" in res && res.needsConfirm) {
        applyPromptState({ needsConfirm: res.needsConfirm });
        return;
      }
      if ("unavailable" in res && res.unavailable) {
        applyPromptState({ unavailable: res.unavailable });
        return;
      }
      if ("error" in res) toast.error(res.error);
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
      .filter((l) => l.updatedOddsAmerican != null && l.class === "changed")
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

  async function onRemoveMovedLeg(line: MovedLinePayload) {
    const match = selections.find((s) => selectionMoveKey(s) === line.moveKey);
    if (match) removeSelection(match.id);
    setMovedLines((prev) =>
      prev ? prev.filter((l) => l.moveKey !== line.moveKey) : null,
    );
    setUnavailableLines((prev) =>
      prev ? prev.filter((l) => l.moveKey !== line.moveKey) : null,
    );
    // After remove, resubmit remaining with any accepts already collected.
    // Defer so removeSelection state settles via next click path — call submit
    // with remaining selections from store after a microtask is fragile;
    // instead submit using filtered list computed here.
    const remaining = selections.filter(
      (s) => selectionMoveKey(s) !== line.moveKey,
    );
    if (remaining.length === 0) {
      setAcceptedSoFar([]);
      setMovedLines(null);
      setUnavailableLines(null);
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "singles") {
        if (remaining.length === 1) {
          const res = await createPlay(
            selectionToPlayInput(
              remaining[0]!,
              remaining[0]!.notes,
              remaining[0]!.notesPublic,
              selectedPackageIds,
            ),
            acceptedSoFar,
          );
          if (res.ok) {
            clearSlip();
            setMovedLines(null);
            setUnavailableLines(null);
            setAcceptedSoFar([]);
            setReceipt(res.receipt);
            return;
          }
          if ("needsConfirm" in res && res.needsConfirm) {
            applyPromptState({ needsConfirm: res.needsConfirm });
            return;
          }
          if ("unavailable" in res && res.unavailable) {
            applyPromptState({ unavailable: res.unavailable });
            return;
          }
          if ("error" in res) toast.error(res.error);
          return;
        }
        const res = await createPlays(
          remaining.map((s) =>
            selectionToPlayInput(s, s.notes, s.notesPublic, selectedPackageIds),
          ),
          acceptedSoFar,
        );
        if (res.ok) {
          await handleBulkSuccess(res.receipt);
          return;
        }
        if ("needsConfirm" in res && res.needsConfirm) {
          applyPromptState({
            needsConfirm: res.needsConfirm,
            unavailable: res.unavailable,
          });
          return;
        }
        if ("unavailable" in res && res.unavailable) {
          applyPromptState({ unavailable: res.unavailable });
          return;
        }
        if ("error" in res) toast.error(res.error);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (receipt && (receipt.kind !== "bulk" || receipt.suspendedCount === 0)) {
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
          <ReceiptStack receipt={receipt} />
        ) : (
          <VerificationReceipt receipt={receipt} />
        )}
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
      onRemoveMovedLeg={onRemoveMovedLeg}
      onCancelMoved={() => {
        setMovedLines(null);
        setAcceptedSoFar([]);
      }}
      onDismissUnavailable={() => setUnavailableLines(null)}
      packageOptions={packageOptions}
      selectedPackageIds={selectedPackageIds}
      onPackageSelectionChange={setSelectedPackageIds}
    />
  );

  const hasSelections = selections.length > 0;
  const partialBulk =
    receipt?.kind === "bulk" && receipt.suspendedCount > 0 ? receipt : null;

  return (
    <div className="mx-auto max-w-xl space-y-5 lg:max-w-5xl">
      {partialBulk ? (
        <div className="mx-auto max-w-md space-y-3">
          <SectionHeader
            title="Plays Logged"
            subtitle="Partial submit — suspended lines stayed in your slip"
          />
          <ReceiptStack receipt={partialBulk} />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setReceipt(null)}
          >
            Back to slip
          </Button>
        </div>
      ) : null}

      <header>
        <p className="scl-eyebrow mb-1 text-[color:var(--scl-muted-data)]">
          Board Record Entry
        </p>
        <div className="scl-section-mark">
          <h1 className="scl-display text-2xl leading-tight font-semibold tracking-[0.04em] sm:text-3xl">
            Log A Pick
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
            Choose a source book, open a matchup, and capture a pre-game price
            into your public record.
          </p>
        </div>
      </header>

      <div
        className={cn(
          "grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start",
        )}
      >
        <div className="min-w-0">
          <GamePicker
            onPick={addPick}
            selectedKeys={selectedKeys}
            lockedBook={
              mode === "parlay"
                ? (selections.find((selection) => selection.book)?.book ?? null)
                : null
            }
          />
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
