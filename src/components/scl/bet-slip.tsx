"use client";

import { X } from "lucide-react";

import { BettingTitle } from "@/components/scl/betting-title";
import { BookMark } from "@/components/scl/book-mark";
import { LeagueRef, TeamRef, isTeamSide } from "@/components/scl/entity-marks";
import { LineMovedPrompt } from "@/components/scl/line-moved-prompt";
import { SlipConflictPrompt } from "@/components/scl/slip-conflict-prompt";
import { SlipModeToggle } from "@/components/scl/slip-mode-toggle";
import { useSlipStore } from "@/components/scl/slip-store";
import { StakeQuickChips } from "@/components/scl/stake-quick-chips";
import { StatValue } from "@/components/scl/stat-value";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UNIT_MAX, UNIT_MIN, UNIT_STEP } from "@/lib/constants";
import type { PickPackageOption } from "@/lib/actions/package-options.action";
import { formatCapturedHmEt } from "@/lib/format-capture";
import { formatOdds } from "@/lib/format";
import {
  americanToDecimal,
  combineDecimalOdds,
  decimalToAmerican,
} from "@/lib/odds";
import type { MovedLinePayload } from "@/lib/odds-movement";
import { bookShort, isBookKey, type BookKey } from "@/lib/books";
import { cn } from "@/lib/utils";

const SUBMIT_CTA = "scl-cta-brand";

/**
 * Unified sportsbook-style bet slip (M5 PR-3 / PR-4).
 * Singles: per-row units + bulk createPlays. Parlay: one stake + combined odds.
 */
export function BetSlip({
  onSubmit,
  submitting,
  movedLines,
  unavailableLines,
  onAcceptMoved,
  onRemoveMovedLeg,
  onCancelMoved,
  onDismissUnavailable,
  packageOptions = [],
  selectedPackageIds = [],
  onPackageSelectionChange,
  className,
}: {
  onSubmit: () => void;
  submitting?: boolean;
  movedLines?: MovedLinePayload[] | null;
  unavailableLines?: MovedLinePayload[] | null;
  onAcceptMoved?: (lines: MovedLinePayload[]) => void;
  onRemoveMovedLeg?: (line: MovedLinePayload) => void;
  onCancelMoved?: () => void;
  onDismissUnavailable?: () => void;
  packageOptions?: PickPackageOption[];
  selectedPackageIds?: string[];
  onPackageSelectionChange?: (ids: string[]) => void;
  className?: string;
}) {
  const {
    mode,
    selections,
    parlayUnits,
    pendingConflict,
    internalConflicts,
    setMode,
    setParlayUnits,
    setSelectionUnits,
    setSelectionNotes,
    setSelectionNotesPublic,
    removeSelection,
    resolveConflictReplace,
    resolveConflictCancel,
  } = useSlipStore();

  const singlesToWin = selections.reduce((sum, s) => {
    if (!(Math.abs(s.oddsAmerican) >= 100) || s.units <= 0) return sum;
    return sum + s.units * (americanToDecimal(s.oddsAmerican) - 1);
  }, 0);
  const singlesStake = selections.reduce((sum, s) => sum + (s.units || 0), 0);

  const priced = selections
    .map((s) => s.oddsAmerican)
    .filter((n) => Math.abs(n) >= 100);
  const combinedAmerican =
    priced.length >= 2
      ? decimalToAmerican(combineDecimalOdds(priced.map(americanToDecimal)))
      : null;
  const parlayToWin =
    combinedAmerican != null && parlayUnits > 0
      ? parlayUnits * (americanToDecimal(combinedAmerican) - 1)
      : null;

  const hasPrompt = Boolean(movedLines?.length || unavailableLines?.length);
  const parlayBlockedByConflicts =
    mode === "parlay" && internalConflicts.length > 0;
  const parlayNeedLegs = mode === "parlay" && selections.length < 2;
  const singlesEmpty = mode === "singles" && selections.length === 0;
  const canSubmitSingles = mode === "singles" && selections.length >= 1;
  const canSubmitParlay =
    mode === "parlay" &&
    selections.length >= 2 &&
    !parlayBlockedByConflicts &&
    !pendingConflict;

  const submitDisabled =
    submitting ||
    hasPrompt ||
    (mode === "singles" && !canSubmitSingles) ||
    (mode === "parlay" && !canSubmitParlay);

  let submitLabel = "Submit";
  if (submitting) submitLabel = "Submitting…";
  else if (mode === "singles" && selections.length === 1)
    submitLabel = "Submit Play";
  else if (mode === "singles" && selections.length > 1)
    submitLabel = `Submit ${selections.length} Plays`;
  else if (mode === "parlay") submitLabel = "Submit parlay";

  let gateReason: string | null = null;
  if (singlesEmpty) gateReason = "Tap a line on the board to build your slip.";
  else if (parlayNeedLegs)
    gateReason = "Add at least 2 legs, or switch to Singles.";
  else if (parlayBlockedByConflicts)
    gateReason = "Remove conflicting legs before submitting this parlay.";

  const bookKeys = [
    ...new Set(
      selections
        .map((s) => (s.book && isBookKey(s.book) ? s.book : null))
        .filter((b): b is BookKey => b != null),
    ),
  ];
  const activeBookLabel =
    bookKeys.length === 1
      ? bookShort(bookKeys[0]!)
      : bookKeys.length > 1
        ? "MIXED"
        : null;

  if (selections.length === 0 && !hasPrompt) {
    return (
      <Card
        className={cn(
          "scl-elevated space-y-3 border border-[color:var(--scl-line)] p-4 sm:p-5",
          className,
        )}
      >
        <SlipModeToggle mode={mode} onChange={setMode} />
        <p className="text-muted-foreground text-sm">
          Tap market chips to add lines. Choose Singles or Parlay in this slip —
          you never leave the board.
        </p>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "scl-elevated space-y-4 border border-[color:color-mix(in_srgb,var(--scl-blue)_32%,var(--scl-line))] p-4 sm:p-5",
        className,
      )}
    >
      <SlipModeToggle mode={mode} onChange={setMode} />

      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="scl-eyebrow text-[color:var(--scl-muted-label)]">
            {mode === "singles"
              ? `Singles · ${selections.length} pick${selections.length === 1 ? "" : "s"}`
              : `Parlay · ${selections.length}-leg${selections.length === 1 ? "" : "s"}`}
            {activeBookLabel ? ` · ${activeBookLabel}` : ""}
          </p>
          {mode === "parlay" && combinedAmerican != null ? (
            <StatValue tone="pink" className="mt-0.5 text-lg font-bold">
              {formatOdds(combinedAmerican)}
            </StatValue>
          ) : mode === "singles" ? (
            <p className="scl-data text-muted-foreground mt-0.5 text-xs">
              Risk {singlesStake.toFixed(2).replace(/\.00$/, "")}u
            </p>
          ) : (
            <p className="text-muted-foreground mt-0.5 text-xs">
              Add 2+ legs to combine
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-muted-foreground text-xs">To win</p>
          <StatValue tone="pink" className="text-lg font-bold">
            {mode === "singles"
              ? singlesToWin > 0
                ? `+${singlesToWin.toFixed(2)}u`
                : "—"
              : parlayToWin != null
                ? `+${parlayToWin.toFixed(2)}u`
                : "—"}
          </StatValue>
        </div>
      </div>

      {pendingConflict ? (
        <SlipConflictPrompt
          message={pendingConflict.conflict.message}
          incomingLabel={`${pendingConflict.pick.selection} · ${formatOdds(pendingConflict.pick.oddsAmerican)}`}
          onCancel={resolveConflictCancel}
          onReplace={resolveConflictReplace}
        />
      ) : null}

      {internalConflicts.length > 0 ? (
        <div
          role="status"
          className="rounded-lg border border-[color:var(--scl-line)] bg-[color:var(--scl-ink-800)] p-3 text-xs"
        >
          <p className="text-foreground font-semibold">
            Same-market conflict in this parlay
          </p>
          <p className="text-muted-foreground mt-1">
            {internalConflicts[0]?.message} Remove one of the conflicting legs
            below.
          </p>
        </div>
      ) : null}

      <ul className="space-y-3">
        {selections.map((s) => {
          const capturedLabel = formatCapturedHmEt(s.capturedAt);
          return (
            <li
              key={s.id}
              className="border-border rounded-[12px] border bg-[color:var(--scl-ink-800)] p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  {isTeamSide(s.side) && s.sport ? (
                    <TeamRef
                      name={s.side}
                      sport={s.sport}
                      size="sm"
                      className="mt-0.5"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <BettingTitle
                      as="p"
                      text={s.selection}
                      className="scl-display text-sm font-bold tracking-[0.02em] break-words uppercase"
                    />
                    <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
                      <span>{s.market}</span>
                      {s.sport ? (
                        <LeagueRef sport={s.sport} league={s.league} markOnly />
                      ) : null}
                      {s.sport ? (
                        <span className="scl-data tracking-[0.06em] uppercase">
                          {s.league?.trim() || s.sport}
                        </span>
                      ) : null}
                      <span className="scl-data text-foreground font-semibold">
                        {formatOdds(s.oddsAmerican)}
                      </span>
                      {capturedLabel ? (
                        <span className="scl-data tracking-[0.06em] uppercase">
                          {capturedLabel}
                        </span>
                      ) : null}
                      {s.book && isBookKey(s.book) ? (
                        <span className="inline-flex items-center gap-1">
                          <BookMark bookKey={s.book} size={16} />
                          <span className="scl-data tracking-[0.06em] uppercase">
                            {bookShort(s.book)}
                          </span>
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${s.selection}`}
                  onClick={() => removeSelection(s.id)}
                  className="text-muted-foreground hover:text-foreground hover:bg-surface-2 min-h-10 min-w-10 shrink-0 rounded-md p-1.5"
                >
                  <X className="size-5" />
                </button>
              </div>

              {mode === "singles" ? (
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-2 items-end gap-2">
                    <div className="space-y-1">
                      <Label htmlFor={`units-${s.id}`}>Units</Label>
                      <Input
                        id={`units-${s.id}`}
                        type="number"
                        step={UNIT_STEP}
                        min={UNIT_MIN}
                        max={UNIT_MAX}
                        value={s.units}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (Number.isFinite(n)) setSelectionUnits(s.id, n);
                        }}
                      />
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground text-xs">To win</p>
                      <StatValue tone="pink" className="text-base font-bold">
                        {s.units > 0 && Math.abs(s.oddsAmerican) >= 100
                          ? `+${(s.units * (americanToDecimal(s.oddsAmerican) - 1)).toFixed(2)}u`
                          : "—"}
                      </StatValue>
                    </div>
                  </div>
                  <StakeQuickChips
                    value={s.units}
                    onChange={(u) => setSelectionUnits(s.id, u)}
                  />
                  <details className="border-border mt-3 rounded-lg border bg-[color:var(--scl-ink-900)] p-3">
                    <summary className="cursor-pointer text-sm font-semibold">
                      Analysis for {s.selection} (optional)
                    </summary>
                    <div className="mt-3 space-y-2">
                      <Label htmlFor={`analysis-${s.id}`} className="sr-only">
                        Analysis for {s.selection}
                      </Label>
                      <textarea
                        id={`analysis-${s.id}`}
                        value={s.notes}
                        onChange={(event) =>
                          setSelectionNotes(s.id, event.target.value)
                        }
                        placeholder="Optional. Why this number — keep it factual."
                        maxLength={1000}
                        rows={3}
                        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-20 w-full resize-y rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                      />
                      <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={s.notesPublic}
                          onChange={(event) =>
                            setSelectionNotesPublic(s.id, event.target.checked)
                          }
                          className="size-4 rounded border-[color:var(--scl-line)]"
                        />
                        Show this analysis on its public pick card
                      </label>
                      <p className="text-muted-foreground text-xs">
                        Each pick keeps its own analysis. Analysis locks when
                        the pick grades.
                      </p>
                    </div>
                  </details>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {packageOptions.length > 0 ? (
        <fieldset className="rounded-[12px] border border-[color:var(--scl-line)] bg-[color:var(--scl-ink-800)] p-3">
          <legend className="px-1 text-sm font-semibold">
            Package attribution
          </legend>
          <p className="text-muted-foreground mb-2 text-xs leading-relaxed">
            Select the packages this pick belongs to. Leave every box unchecked
            and it goes to all{" "}
            {packageOptions.length === 1
              ? "of your packages"
              : `${packageOptions.length} of your packages`}
            .
          </p>
          <div className="space-y-1">
            {packageOptions.map((option) => {
              const checked = selectedPackageIds.includes(option.id);
              const atLimit = selectedPackageIds.length >= 10;
              return (
                <label
                  key={option.id}
                  className="hover:bg-surface-2 flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!checked && atLimit}
                    onChange={() => {
                      onPackageSelectionChange?.(
                        checked
                          ? selectedPackageIds.filter((id) => id !== option.id)
                          : [...selectedPackageIds, option.id],
                      );
                    }}
                    className="size-4 rounded border-[color:var(--scl-line)]"
                  />
                  <span>{option.title}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {mode === "parlay" ? (
        <div className="space-y-1.5">
          <Label htmlFor="parlay-units">Stake (units)</Label>
          <Input
            id="parlay-units"
            type="number"
            step={UNIT_STEP}
            min={UNIT_MIN}
            max={UNIT_MAX}
            value={parlayUnits}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) setParlayUnits(n);
            }}
          />
          <StakeQuickChips value={parlayUnits} onChange={setParlayUnits} />
          <p className="text-muted-foreground text-xs">
            Stake lives on the parlay; legs are components.
          </p>
        </div>
      ) : null}

      {unavailableLines?.length ? (
        <LineMovedPrompt
          mode="blocked"
          lines={unavailableLines}
          onRemoveLeg={(line) => onRemoveMovedLeg?.(line)}
          onCancel={() => onDismissUnavailable?.()}
        />
      ) : null}
      {movedLines?.length ? (
        <LineMovedPrompt
          mode="confirm"
          lines={movedLines}
          onAcceptAll={(lines) => onAcceptMoved?.(lines)}
          onRemoveLeg={(line) => onRemoveMovedLeg?.(line)}
          onCancel={() => onCancelMoved?.()}
        />
      ) : null}

      {gateReason && !hasPrompt ? (
        <p className="text-muted-foreground text-xs" role="status">
          {gateReason}
        </p>
      ) : null}

      {!hasPrompt ? (
        <Button
          type="button"
          onClick={onSubmit}
          disabled={submitDisabled}
          className={`min-h-12 w-full text-base ${SUBMIT_CTA}`}
        >
          {submitLabel}
        </Button>
      ) : null}
    </Card>
  );
}
