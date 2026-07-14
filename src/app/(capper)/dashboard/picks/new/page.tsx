"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { EntryModeCards } from "@/components/scl/entry-mode-cards";
import { GamePicker } from "@/components/scl/game-picker";
import { LineMovedPrompt } from "@/components/scl/line-moved-prompt";
import { MobileSlipDock } from "@/components/scl/mobile-slip-dock";
import { BettingTitle } from "@/components/scl/betting-title";
import { SectionHeader } from "@/components/scl/section";
import { StakeQuickChips } from "@/components/scl/stake-quick-chips";
import { StatValue } from "@/components/scl/stat-value";
import { VerificationReceipt } from "@/components/scl/verification-receipt";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createPlay,
  type AcceptedMove,
  type MovedLinePayload,
} from "@/lib/actions/play.action";
import { UNIT_MAX, UNIT_MIN, UNIT_STEP } from "@/lib/constants";
import { formatOdds } from "@/lib/format";
import { americanToDecimal } from "@/lib/odds";
import {
  playSchema,
  type PlayFormInput,
  type PlayInput,
} from "@/lib/schemas/play.schema";
import { pickKey } from "@/lib/slip";
import { useIsLg } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import type { StraightReceipt } from "@/lib/verification";

const PINK_CTA =
  "border-[color:var(--scl-pink)] bg-[color:var(--scl-pink)] text-[color:var(--scl-pink-ink)] hover:bg-[color:var(--scl-pink-deep)] hover:text-[color:var(--scl-pink-ink)]";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-neg text-xs">{message}</p>;
}

/**
 * Straight entry — GamePicker → MarketChip → BetSlip → verified receipt.
 * M4 PR-4 / SCL_M4_PICK_REDESIGN §4.1 · §4.3 · §4.5.
 */
export default function NewPlayPage() {
  const [receipt, setReceipt] = useState<StraightReceipt | null>(null);
  const [movedLines, setMovedLines] = useState<MovedLinePayload[] | null>(null);
  const [unavailableLines, setUnavailableLines] = useState<
    MovedLinePayload[] | null
  >(null);
  const [pendingValues, setPendingValues] = useState<PlayInput | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isLg = useIsLg();
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PlayFormInput, unknown, PlayInput>({
    resolver: zodResolver(playSchema),
    defaultValues: { units: 1 },
  });
  const selection = useWatch({ control, name: "selection" });
  const market = useWatch({ control, name: "market" });
  const odds = useWatch({ control, name: "oddsAmerican" });
  const units = useWatch({ control, name: "units" });
  const eventId = useWatch({ control, name: "eventId" });
  const side = useWatch({ control, name: "side" });
  const line = useWatch({ control, name: "line" });
  const player = useWatch({ control, name: "player" });
  const sport = useWatch({ control, name: "sport" });
  const eventBound = Boolean(eventId);

  const oddsNum = Number(odds);
  const rawLine =
    typeof line === "number"
      ? line
      : line === "" || line == null
        ? undefined
        : Number(line);
  const selectedLine =
    typeof rawLine === "number" && Number.isFinite(rawLine)
      ? rawLine
      : undefined;
  const hasPick = Boolean(selection && market && Math.abs(oddsNum) >= 100);
  const selectedKeys =
    hasPick && eventId
      ? new Set([
          pickKey({
            eventId,
            market: market ?? "",
            side: side ?? "",
            line: selectedLine,
            oddsAmerican: oddsNum,
            player,
          }),
        ])
      : undefined;
  const toWin =
    hasPick && typeof units === "number" && units > 0
      ? units * (americanToDecimal(oddsNum) - 1)
      : null;

  async function submitPlay(values: PlayInput, acceptedMoves?: AcceptedMove[]) {
    setSubmitting(true);
    try {
      const res = await createPlay(values, acceptedMoves);
      if (res.ok) {
        setMovedLines(null);
        setUnavailableLines(null);
        setPendingValues(null);
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

  async function onSubmit(values: PlayInput) {
    await submitPlay(values);
  }

  async function acceptMoved(lines: MovedLinePayload[]) {
    if (!pendingValues) return;
    const acceptedMoves: AcceptedMove[] = lines
      .filter((l) => l.updatedOddsAmerican != null)
      .map((l) => ({
        moveKey: l.moveKey,
        selectedOddsAmerican: l.selectedOddsAmerican,
        acceptedOddsAmerican: l.updatedOddsAmerican as number,
      }));
    // Keep selected oddsAmerican as the original tap; server persists live via acceptedMoves.
    await submitPlay(pendingValues, acceptedMoves);
  }

  function clearEventBinding() {
    setValue("eventId", "");
    setValue("eventStartsAt", "");
    setValue("side", "");
    setValue("line", undefined as unknown as number);
    setValue("player", "");
    setValue("book", "");
  }

  function clearPick() {
    setValue("selection", "");
    setValue("market", "");
    setValue("oddsAmerican", "" as unknown as number);
    setValue("sport", "" as PlayFormInput["sport"]);
    clearEventBinding();
    setMovedLines(null);
    setUnavailableLines(null);
    setPendingValues(null);
  }

  if (receipt) {
    return (
      <div className="mx-auto max-w-xl space-y-5">
        <SectionHeader
          title="Play Logged"
          subtitle="Confirmation for your record"
        />
        <VerificationReceipt receipt={receipt} />
      </div>
    );
  }

  const slipBody = hasPick ? (
    <Card className="scl-elevated space-y-4 border border-[color:var(--scl-pink-deep)] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="scl-eyebrow text-[color:var(--scl-muted-label)]">
            Bet slip
          </p>
          <BettingTitle
            as="p"
            text={selection ?? ""}
            className="scl-display mt-0.5 text-lg font-bold tracking-[0.02em] break-words uppercase"
          />
          <p className="text-muted-foreground text-sm">
            {market}
            {sport ? ` · ${sport}` : ""} ·{" "}
            <StatValue tone="text" className="font-semibold">
              {formatOdds(oddsNum)}
            </StatValue>
          </p>
          {eventBound ? (
            <p className="scl-data mt-1 text-[0.7rem] font-medium text-[color:var(--scl-win)]">
              Pre-game · odds will be verified
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={clearPick}
          aria-label="Clear pick"
          className="text-muted-foreground hover:text-foreground hover:bg-surface-2 min-h-10 min-w-10 rounded-md p-1.5"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="units">Units</Label>
          <Input
            id="units"
            type="number"
            step={UNIT_STEP}
            min={UNIT_MIN}
            max={UNIT_MAX}
            {...register("units", { valueAsNumber: true })}
          />
        </div>
        <div className="text-right">
          <p className="text-muted-foreground text-xs">To win</p>
          <StatValue tone="pink" className="text-xl font-bold">
            {toWin != null ? `+${toWin.toFixed(2)}u` : "—"}
          </StatValue>
        </div>
      </div>
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
      <FieldError message={errors.sport?.message} />

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <textarea
          id="notes"
          rows={2}
          className="border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 min-h-16 w-full rounded-lg border bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none"
          placeholder="Reasoning (kept on your record)"
          {...register("notes")}
        />
      </div>

      {unavailableLines ? (
        <LineMovedPrompt
          mode="blocked"
          lines={unavailableLines}
          onCancel={() => {
            setUnavailableLines(null);
            clearPick();
          }}
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
          }}
        />
      ) : null}

      {!movedLines && !unavailableLines ? (
        <Button
          type="button"
          onClick={handleSubmit(onSubmit)}
          disabled={isSubmitting || submitting}
          className={`min-h-12 w-full text-base ${PINK_CTA}`}
        >
          {isSubmitting || submitting ? "Submitting…" : "Submit Play"}
        </Button>
      ) : null}
    </Card>
  ) : null;

  return (
    <div className="mx-auto max-w-xl space-y-5 lg:max-w-5xl">
      <div>
        <p className="scl-eyebrow mb-1 text-[color:var(--scl-muted-label)]">
          Verified Board Entry
        </p>
        <SectionHeader
          title="Submit A Play"
          subtitle="Find a game, tap a line, set your units"
        />
      </div>

      <EntryModeCards mode="straight" />

      {/* Board stays visible on mobile; slip is desktop sticky column + mobile bottom dock. */}
      <div
        className={cn(
          "grid gap-5 lg:items-start",
          hasPick && "lg:grid-cols-[minmax(0,1fr)_20rem]",
        )}
      >
        <div className="min-w-0">
          <GamePicker
            selectedKeys={selectedKeys}
            onPick={(pick) => {
              setValue("sport", pick.sport as PlayFormInput["sport"], {
                shouldValidate: true,
              });
              setValue("market", pick.market, { shouldValidate: true });
              setValue("selection", pick.selection, {
                shouldValidate: true,
              });
              setValue("oddsAmerican", pick.oddsAmerican, {
                shouldValidate: true,
              });
              setValue("eventId", pick.eventId);
              setValue("eventStartsAt", pick.eventStartsAt);
              setValue("side", pick.side);
              setValue("line", pick.line as number | undefined);
              setValue("player", pick.player ?? "");
              setValue("book", pick.book ?? "");
            }}
          />
        </div>

        {hasPick && isLg ? (
          <div className="min-w-0 lg:sticky lg:top-20">{slipBody}</div>
        ) : null}
      </div>

      {hasPick && isLg === false ? (
        <MobileSlipDock
          title="Bet slip"
          countLabel="1 Leg"
          oddsLabel={formatOdds(oddsNum)}
        >
          {slipBody}
        </MobileSlipDock>
      ) : null}
    </div>
  );
}
