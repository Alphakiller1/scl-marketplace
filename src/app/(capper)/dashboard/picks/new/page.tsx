"use client";

import { useState } from "react";
import { X } from "lucide-react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { MobileSlipDock } from "@/components/scl/mobile-slip-dock";
import { BettingTitle } from "@/components/scl/betting-title";
import { OddsAssist } from "@/components/scl/odds-assist";
import { SectionHeader } from "@/components/scl/section";
import { SportPills } from "@/components/scl/sport-pills";
import { StakeQuickChips } from "@/components/scl/stake-quick-chips";
import { StatValue } from "@/components/scl/stat-value";
import { Ticket } from "@/components/scl/ticket";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPlay } from "@/lib/actions/play.action";
import { UNIT_MAX, UNIT_MIN, UNIT_STEP } from "@/lib/constants";
import { formatOdds, formatUnits } from "@/lib/format";
import { americanToDecimal } from "@/lib/odds";
import {
  playSchema,
  type PlayFormInput,
  type PlayInput,
} from "@/lib/schemas/play.schema";
import { pickKey } from "@/lib/slip";
import { useIsLg } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import { isVerifiedTier, type StraightReceipt } from "@/lib/verification";

const PINK_CTA =
  "border-[color:var(--scl-pink)] bg-[color:var(--scl-pink)] text-[color:var(--scl-pink-ink)] hover:bg-[color:var(--scl-pink-deep)] hover:text-[color:var(--scl-pink-ink)]";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-neg text-xs">{message}</p>;
}

export default function NewPlayPage() {
  const [receipt, setReceipt] = useState<StraightReceipt | null>(null);
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
  const sport = useWatch({ control, name: "sport" });
  const selection = useWatch({ control, name: "selection" });
  const market = useWatch({ control, name: "market" });
  const odds = useWatch({ control, name: "oddsAmerican" });
  const units = useWatch({ control, name: "units" });
  const eventId = useWatch({ control, name: "eventId" });
  const side = useWatch({ control, name: "side" });
  const line = useWatch({ control, name: "line" });
  const player = useWatch({ control, name: "player" });
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

  async function onSubmit(values: PlayInput) {
    const res = await createPlay(values);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setReceipt(res.receipt);
  }

  // Event binding is what promotes a pick to the strict/verified path. Any time the pick is
  // hand-edited or reset it must be dropped, so a stale board line never attaches to a
  // different selection.
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
    clearEventBinding();
  }

  if (receipt) {
    const verified = isVerifiedTier(receipt.tier);
    const stake =
      receipt.units != null ? formatUnits(receipt.units, true, false) : "—";
    const toWin =
      receipt.toWinUnits != null
        ? formatUnits(receipt.toWinUnits, true, false)
        : "—";
    return (
      <div className="mx-auto max-w-xl space-y-5">
        <SectionHeader
          title="Play Logged"
          subtitle="Confirmation for your record"
        />
        <Ticket
          selectionTitle={receipt.selection}
          eventLine={receipt.market}
          legs={1}
          odds={formatOdds(receipt.oddsAmerican)}
          stake={stake}
          toWin={toWin}
          capturedAt={receipt.capturedAt}
          status={verified ? "verified" : "muted"}
          footerAction={
            <Button
              className={`min-h-12 w-full text-base ${PINK_CTA}`}
              render={<Link href="/dashboard/picks" />}
              nativeButton={false}
            >
              View on your record
            </Button>
          }
        />
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
            {market} ·{" "}
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

      <Button
        type="button"
        onClick={handleSubmit(onSubmit)}
        disabled={isSubmitting}
        className={`min-h-12 w-full text-base ${PINK_CTA}`}
      >
        {isSubmitting ? "Submitting…" : "Submit Play"}
      </Button>
    </Card>
  ) : null;

  return (
    <div className="mx-auto max-w-xl space-y-5 lg:max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="scl-eyebrow mb-1 text-[color:var(--scl-muted-label)]">
            Verified Board Entry
          </p>
          <SectionHeader
            title="Submit A Play"
            subtitle="Tap a line off the board, set your units, submit"
          />
        </div>
        <Button
          variant="ghost"
          render={<Link href="/dashboard/picks/new/parlay" />}
          nativeButton={false}
          className="min-h-11"
        >
          Parlay
        </Button>
      </div>

      <Card className="space-y-2 p-4 sm:p-5">
        <Label>Sport</Label>
        <SportPills
          value={sport ?? ""}
          onChange={(key) => setValue("sport", key, { shouldValidate: true })}
        />
        <FieldError message={errors.sport?.message} />
      </Card>

      {/* Board stays visible on mobile; slip is desktop sticky column + mobile bottom dock. */}
      <div
        className={cn(
          "grid gap-5 lg:items-start",
          hasPick && "lg:grid-cols-[minmax(0,1fr)_20rem]",
        )}
      >
        {sport ? (
          <div className="min-w-0">
            <OddsAssist
              sport={sport}
              selectedKeys={selectedKeys}
              onPick={(pick) => {
                setValue("market", pick.market, { shouldValidate: true });
                setValue("selection", pick.selection, {
                  shouldValidate: true,
                });
                setValue("oddsAmerican", pick.oddsAmerican, {
                  shouldValidate: true,
                });
                // Carry the event binding so createPlay runs the strict path (C1 lock + C3 odds).
                setValue("eventId", pick.eventId);
                setValue("eventStartsAt", pick.eventStartsAt);
                setValue("side", pick.side);
                setValue("line", pick.line as number | undefined);
                setValue("player", pick.player ?? "");
                setValue("book", pick.book ?? "");
              }}
            />
          </div>
        ) : null}

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
