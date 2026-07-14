"use client";

import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { EntryModeCards } from "@/components/scl/entry-mode-cards";
import { GamePicker, type OddsPick } from "@/components/scl/game-picker";
import { LineMovedPrompt } from "@/components/scl/line-moved-prompt";
import { MobileSlipDock } from "@/components/scl/mobile-slip-dock";
import { ParlayLegCard } from "@/components/scl/parlay-leg-card";
import { SectionHeader } from "@/components/scl/section";
import { SlipConflictPrompt } from "@/components/scl/slip-conflict-prompt";
import { StakeQuickChips } from "@/components/scl/stake-quick-chips";
import { StatValue } from "@/components/scl/stat-value";
import { VerificationReceipt } from "@/components/scl/verification-receipt";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createParlay,
  type AcceptedMove,
  type MovedLinePayload,
} from "@/lib/actions/parlay.action";
import { UNIT_MAX, UNIT_MIN, UNIT_STEP } from "@/lib/constants";
import { formatOdds } from "@/lib/format";
import {
  americanToDecimal,
  combineDecimalOdds,
  decimalToAmerican,
} from "@/lib/odds";
import {
  createParlaySchema,
  type CreateParlayFormInput,
  type CreateParlayInput,
} from "@/lib/schemas/parlay.schema";
import {
  findConflict,
  pickKey,
  toSlipLeg,
  type SlipConflict,
  type SlipPick,
} from "@/lib/slip";
import { useIsLg } from "@/lib/use-media-query";
import type { ParlayReceipt } from "@/lib/verification";

const PINK_CTA =
  "border-[color:var(--scl-pink)] bg-[color:var(--scl-pink)] text-[color:var(--scl-pink-ink)] hover:bg-[color:var(--scl-pink-deep)] hover:text-[color:var(--scl-pink-ink)]";
const MAX_LEGS = 12;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-neg text-xs">{message}</p>;
}

function legToSlipPick(l: {
  eventId?: string;
  market?: string;
  side?: string;
  line?: unknown;
  oddsAmerican?: unknown;
  player?: string;
}): SlipPick {
  const line =
    typeof l.line === "number" && Number.isFinite(l.line) ? l.line : undefined;
  return {
    eventId: l.eventId ?? "",
    market: l.market ?? "",
    side: l.side ?? "",
    line,
    oddsAmerican: Number(l.oddsAmerican),
    player: l.player,
  };
}

/**
 * Parlay entry — collapsible leg cards each embedding GamePicker.
 * M4 PR-4 / SCL_M4_PICK_REDESIGN §4.1 · §4.4 · §4.5.
 */
export default function NewParlayPage() {
  const [receipt, setReceipt] = useState<ParlayReceipt | null>(null);
  /** Which leg card is expanded; `fields.length` = the open "add leg" slot. */
  const [expanded, setExpanded] = useState<number>(0);
  const [pendingConflict, setPendingConflict] = useState<{
    conflict: SlipConflict;
    pick: OddsPick;
    /** When replacing into an existing expanded leg index. */
    targetIndex: number | null;
  } | null>(null);
  const [movedLines, setMovedLines] = useState<MovedLinePayload[] | null>(null);
  const [unavailableLines, setUnavailableLines] = useState<
    MovedLinePayload[] | null
  >(null);
  const [pendingValues, setPendingValues] = useState<CreateParlayInput | null>(
    null,
  );
  const [acceptedSoFar, setAcceptedSoFar] = useState<AcceptedMove[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const isLg = useIsLg();
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateParlayFormInput, unknown, CreateParlayInput>({
    resolver: zodResolver(createParlaySchema),
    defaultValues: { units: 1, legs: [] },
  });
  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "legs",
  });

  const legs = useWatch({ control, name: "legs" });
  const units = useWatch({ control, name: "units" });
  const priced = (legs ?? [])
    .map((l) => Number(l?.oddsAmerican))
    .filter((n) => Math.abs(n) >= 100);
  const combinedAmerican =
    priced.length >= 2
      ? decimalToAmerican(combineDecimalOdds(priced.map(americanToDecimal)))
      : null;
  const toWin =
    combinedAmerican != null && typeof units === "number" && units > 0
      ? units * (americanToDecimal(combinedAmerican) - 1)
      : null;

  const slipLegs = (legs ?? []).map(legToSlipPick);
  const selectedKeys = new Set(slipLegs.map(pickKey));
  const canAdd = fields.length < MAX_LEGS;
  const addSlotIndex = fields.length;

  function applyPick(pick: OddsPick, targetIndex: number | null) {
    const conflict = findConflict(slipLegs, pick);
    if (!conflict) {
      setPendingConflict(null);
      if (targetIndex != null && targetIndex < fields.length) {
        update(targetIndex, toSlipLeg(pick));
        setExpanded(Math.min(fields.length, MAX_LEGS - 1));
      } else {
        append(toSlipLeg(pick));
        // After append, next add slot is fields.length + 1 — open it if room.
        setExpanded(
          fields.length + 1 < MAX_LEGS ? fields.length + 1 : fields.length,
        );
      }
      return;
    }
    if (conflict.kind === "duplicate") {
      setPendingConflict(null);
      return;
    }
    setPendingConflict({ conflict, pick, targetIndex });
  }

  async function submitParlay(
    values: CreateParlayInput,
    acceptedMoves?: AcceptedMove[],
  ) {
    setSubmitting(true);
    try {
      const res = await createParlay(values, acceptedMoves);
      if (res.ok) {
        setMovedLines(null);
        setUnavailableLines(null);
        setPendingValues(null);
        setAcceptedSoFar([]);
        setReceipt(res.receipt);
        return;
      }
      if ("needsConfirm" in res && res.needsConfirm) {
        setPendingValues(values);
        setUnavailableLines(null);
        setMovedLines(res.needsConfirm);
        return;
      }
      if ("unavailable" in res && res.unavailable) {
        setPendingValues(null);
        setMovedLines(null);
        setAcceptedSoFar([]);
        setUnavailableLines(res.unavailable);
        return;
      }
      if ("error" in res) {
        toast.error(res.error);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmit(values: CreateParlayInput) {
    setAcceptedSoFar([]);
    await submitParlay(values);
  }

  async function acceptMoved(lines: MovedLinePayload[]) {
    if (!pendingValues) return;
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
    await submitParlay(pendingValues, merged);
  }

  if (receipt) {
    return (
      <div className="mx-auto max-w-xl space-y-5">
        <SectionHeader
          title="Parlay Logged"
          subtitle="Confirmation for your record"
        />
        <VerificationReceipt receipt={receipt} />
      </div>
    );
  }

  const slipBody = (
    <Card className="scl-elevated space-y-3 border border-[color:var(--scl-pink-deep)] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="scl-eyebrow text-[color:var(--scl-muted-label)]">
            Parlay · {fields.length}-leg
            {fields.length === 1 ? "" : "s"}
          </p>
          {combinedAmerican != null ? (
            <StatValue tone="pink" className="mt-0.5 text-lg font-bold">
              {formatOdds(combinedAmerican)}
            </StatValue>
          ) : (
            <p className="text-muted-foreground mt-0.5 text-xs">
              Add 2+ legs to combine
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-muted-foreground text-xs">To win</p>
          <StatValue tone="pink" className="text-lg font-bold">
            {toWin != null ? `+${toWin.toFixed(2)}u` : "—"}
          </StatValue>
        </div>
      </div>

      {pendingConflict ? (
        <SlipConflictPrompt
          message={pendingConflict.conflict.message}
          incomingLabel={`${pendingConflict.pick.selection} · ${formatOdds(pendingConflict.pick.oddsAmerican)}`}
          onCancel={() => setPendingConflict(null)}
          onReplace={() => {
            const { conflict, pick } = pendingConflict;
            update(conflict.index, toSlipLeg(pick));
            setPendingConflict(null);
            setExpanded(
              fields.length < MAX_LEGS ? fields.length : conflict.index,
            );
          }}
        />
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="units">Stake (units)</Label>
        <Input
          id="units"
          type="number"
          step={UNIT_STEP}
          min={UNIT_MIN}
          max={UNIT_MAX}
          {...register("units", { valueAsNumber: true })}
        />
        <StakeQuickChips
          value={typeof units === "number" ? units : null}
          onChange={(u) =>
            setValue("units", u, { shouldValidate: true, shouldDirty: true })
          }
        />
        <p className="text-muted-foreground text-xs">
          Stake lives on the parlay; legs are components.
        </p>
        <FieldError message={errors.units?.message} />
      </div>

      <FieldError message={errors.legs?.message} />

      {unavailableLines ? (
        <LineMovedPrompt
          mode="blocked"
          lines={unavailableLines}
          onCancel={() => setUnavailableLines(null)}
        />
      ) : null}
      {movedLines ? (
        <LineMovedPrompt
          mode="confirm"
          lines={movedLines}
          onAcceptAll={acceptMoved}
          onCancel={() => {
            setMovedLines(null);
            setPendingValues(null);
            setAcceptedSoFar([]);
          }}
        />
      ) : null}

      {!movedLines && !unavailableLines ? (
        <Button
          type="button"
          onClick={handleSubmit(onSubmit)}
          disabled={isSubmitting || submitting || fields.length < 2}
          className={`min-h-12 w-full text-base ${PINK_CTA}`}
        >
          {isSubmitting || submitting ? "Submitting…" : "Submit parlay"}
        </Button>
      ) : null}
    </Card>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5 lg:max-w-5xl">
      <div>
        <p className="scl-eyebrow mb-1 text-[color:var(--scl-muted-label)]">
          Verified Board Entry
        </p>
        <SectionHeader
          title="Submit A Parlay"
          subtitle="Build legs from the same game board — 2 to 12"
        />
      </div>

      <EntryModeCards mode="parlay" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-3">
          <div className="flex items-baseline justify-between gap-2 px-0.5">
            <p className="scl-display text-sm font-semibold tracking-[0.08em] uppercase">
              Parlay
            </p>
            <span className="scl-data text-[0.65rem] tracking-[0.1em] text-[color:var(--scl-muted-label)] uppercase">
              {fields.length} leg{fields.length === 1 ? "" : "s"}
              {combinedAmerican != null
                ? ` · ${formatOdds(combinedAmerican)}`
                : ""}
            </span>
          </div>

          {fields.map((field, i) => {
            const leg = legs?.[i];
            const legOdds = Number(leg?.oddsAmerican);
            const isOpen = expanded === i;
            return (
              <ParlayLegCard
                key={field.id}
                index={i}
                expanded={isOpen}
                selection={leg?.selection}
                oddsAmerican={Math.abs(legOdds) >= 100 ? legOdds : undefined}
                league={leg?.sport}
                onToggle={() => setExpanded(isOpen ? -1 : i)}
                onRemove={() => {
                  remove(i);
                  setPendingConflict(null);
                  setExpanded(Math.min(i, Math.max(0, fields.length - 2)));
                }}
              >
                <GamePicker
                  selectedKeys={selectedKeys}
                  onPick={(pick) => applyPick(pick, i)}
                />
              </ParlayLegCard>
            );
          })}

          {canAdd ? (
            <ParlayLegCard
              index={addSlotIndex}
              expanded={expanded === addSlotIndex || fields.length === 0}
              onToggle={() =>
                setExpanded(
                  expanded === addSlotIndex && fields.length > 0
                    ? -1
                    : addSlotIndex,
                )
              }
            >
              <GamePicker
                selectedKeys={selectedKeys}
                onPick={(pick) => applyPick(pick, null)}
              />
            </ParlayLegCard>
          ) : null}

          {fields.length === 0 ? (
            <p className="text-muted-foreground px-0.5 text-xs">
              Expand a leg, pick a game, tap a line — units stay in the slip.
            </p>
          ) : null}
        </div>

        {isLg ? (
          <div className="min-w-0 lg:sticky lg:top-20">{slipBody}</div>
        ) : null}
      </div>

      {isLg === false && fields.length > 0 ? (
        <MobileSlipDock
          title="Parlay slip"
          countLabel={`${fields.length} ${fields.length === 1 ? "Leg" : "Legs"}`}
          oddsLabel={
            combinedAmerican != null ? formatOdds(combinedAmerican) : null
          }
        >
          {slipBody}
        </MobileSlipDock>
      ) : null}

      {isLg === false && fields.length === 0 ? (
        <Card className="space-y-1.5 p-4 sm:p-5">
          <Label htmlFor="units-mobile">Stake (units)</Label>
          <Input
            id="units-mobile"
            type="number"
            step={UNIT_STEP}
            min={UNIT_MIN}
            max={UNIT_MAX}
            {...register("units", { valueAsNumber: true })}
          />
          <StakeQuickChips
            value={typeof units === "number" ? units : null}
            onChange={(u) =>
              setValue("units", u, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
          />
          <FieldError message={errors.units?.message} />
        </Card>
      ) : null}
    </div>
  );
}
