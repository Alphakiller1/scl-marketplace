"use client";

import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { MobileSlipDock } from "@/components/scl/mobile-slip-dock";
import { OddsAssist, type OddsPick } from "@/components/scl/odds-assist";
import { SectionHeader } from "@/components/scl/section";
import { SlipConflictPrompt } from "@/components/scl/slip-conflict-prompt";
import { SportPills } from "@/components/scl/sport-pills";
import { StakeQuickChips } from "@/components/scl/stake-quick-chips";
import { StatValue } from "@/components/scl/stat-value";
import { Ticket } from "@/components/scl/ticket";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createParlay } from "@/lib/actions/parlay.action";
import { UNIT_MAX, UNIT_MIN, UNIT_STEP } from "@/lib/constants";
import { formatOdds, formatUnits } from "@/lib/format";
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
import { cn } from "@/lib/utils";
import { isVerifiedTier, type ParlayReceipt } from "@/lib/verification";

const GOLD_CTA =
  "border-[color:var(--scl-gold)] bg-[color:var(--scl-gold)] text-[color:var(--scl-gold-ink)] hover:bg-[color:var(--scl-gold-deep)] hover:text-[color:var(--scl-gold-ink)]";

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

export default function NewParlayPage() {
  const [receipt, setReceipt] = useState<ParlayReceipt | null>(null);
  const [sport, setSport] = useState("");
  const [pendingConflict, setPendingConflict] = useState<{
    conflict: SlipConflict;
    pick: OddsPick;
  } | null>(null);
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
  // Keys of legs already on the slip — the board marks these chips selected + disabled.
  const selectedKeys = new Set(slipLegs.map(pickKey));

  async function onSubmit(values: CreateParlayInput) {
    const res = await createParlay(values);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setReceipt(res.receipt);
  }

  if (receipt) {
    const verified =
      receipt.verifiedLegCount === receipt.legCount &&
      receipt.tiers.every(isVerifiedTier);
    const stake =
      receipt.units != null ? formatUnits(receipt.units, true, false) : "—";
    const toWin =
      receipt.toWinUnits != null
        ? formatUnits(receipt.toWinUnits, true, false)
        : "—";
    return (
      <div className="mx-auto max-w-xl space-y-5">
        <SectionHeader
          title="Parlay Logged"
          subtitle="Confirmation for your record"
        />
        <Ticket
          selectionTitle={`${receipt.legCount}-Leg Parlay`}
          eventLine={null}
          legs={receipt.legCount}
          odds={formatOdds(receipt.combinedOddsAmerican)}
          stake={stake}
          toWin={toWin}
          capturedAt={receipt.capturedAt}
          status={verified ? "verified" : "muted"}
          footerAction={
            <Button
              className={`min-h-12 w-full text-base ${GOLD_CTA}`}
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

  // Shared slip — rendered in the desktop sticky column and the mobile dock. Carries the
  // inline Replace/Cancel prompt so same-market conflicts resolve in either surface.
  const slipBody = (
    <Card className="scl-elevated space-y-3 border border-[color:var(--scl-gold-deep)] p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="scl-eyebrow text-[color:var(--scl-muted-label)]">
          Parlay slip
        </p>
        <StatValue tone="label" className="text-xs">
          {fields.length} {fields.length === 1 ? "leg" : "legs"}
        </StatValue>
      </div>

      {pendingConflict ? (
        <SlipConflictPrompt
          message={pendingConflict.conflict.message}
          incomingLabel={`${pendingConflict.pick.selection} · ${formatOdds(pendingConflict.pick.oddsAmerican)}`}
          onCancel={() => setPendingConflict(null)}
          onReplace={() => {
            const { conflict, pick } = pendingConflict;
            update(conflict.index, toSlipLeg(pick, sport));
            setPendingConflict(null);
          }}
        />
      ) : null}

      {fields.length ? (
        <div className="divide-border divide-y">
          {fields.map((field, i) => {
            const leg = legs?.[i];
            const legOdds = Number(leg?.oddsAmerican);
            const conflicting = pendingConflict?.conflict.index === i;
            return (
              <div
                key={field.id}
                className={cn(
                  "flex items-center justify-between gap-3 py-2.5",
                  conflicting &&
                    "-mx-2 rounded-md bg-[color:var(--scl-ink-700)] px-2",
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {leg?.selection || `Leg ${i + 1}`}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {leg?.market}
                    {Math.abs(legOdds) >= 100 ? (
                      <>
                        {" · "}
                        <StatValue tone="data" className="font-semibold">
                          {formatOdds(legOdds)}
                        </StatValue>
                      </>
                    ) : null}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    remove(i);
                    setPendingConflict(null);
                  }}
                  aria-label={`Remove leg ${i + 1}`}
                  className="text-muted-foreground hover:text-foreground hover:bg-surface-2 min-h-10 min-w-10 rounded-md p-1.5"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-muted-foreground py-2 text-xs">
          Tap lines from the board above to add legs (2–12).
        </p>
      )}

      {combinedAmerican != null ? (
        <div className="border-border flex items-center justify-between border-t pt-3">
          <div>
            <p className="text-muted-foreground text-xs">
              {priced.length}-leg parlay
            </p>
            <StatValue tone="gold" className="text-lg font-bold">
              {formatOdds(combinedAmerican)}
            </StatValue>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground text-xs">To win</p>
            <StatValue tone="gold" className="text-lg font-bold">
              {toWin != null ? `+${toWin.toFixed(2)}u` : "—"}
            </StatValue>
          </div>
        </div>
      ) : null}

      <FieldError message={errors.legs?.message} />

      <Button
        type="button"
        onClick={handleSubmit(onSubmit)}
        disabled={isSubmitting || fields.length < 2}
        className={`min-h-12 w-full text-base ${GOLD_CTA}`}
      >
        {isSubmitting ? "Submitting…" : "Submit parlay"}
      </Button>
    </Card>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5 lg:max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <SectionHeader
          title="Submit A Parlay"
          subtitle="Tap 2+ lines off the board to build your legs"
        />
        <Button
          variant="ghost"
          render={<Link href="/dashboard/picks/new" />}
          nativeButton={false}
          className="min-h-11"
        >
          Single play
        </Button>
      </div>

      <Card className="space-y-1.5 p-4 sm:p-5">
        <Label htmlFor="units">Stake (units)</Label>
        <Input
          id="units"
          type="number"
          step={UNIT_STEP}
          min={UNIT_MIN}
          max={UNIT_MAX}
          className="sm:max-w-40"
          {...register("units", { valueAsNumber: true })}
        />
        <StakeQuickChips
          value={typeof units === "number" ? units : null}
          onChange={(u) =>
            setValue("units", u, { shouldValidate: true, shouldDirty: true })
          }
        />
        <p className="text-muted-foreground text-xs">
          The parlay carries the stake; legs are components.
        </p>
        <FieldError message={errors.units?.message} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-5">
          <Card className="space-y-2 p-4 sm:p-5">
            <Label>Add legs from the board</Label>
            <SportPills
              value={sport}
              onChange={(key) => {
                setSport(key);
                setPendingConflict(null);
              }}
            />
          </Card>

          {sport ? (
            <OddsAssist
              sport={sport}
              selectedKeys={selectedKeys}
              onPick={(pick) => {
                const conflict = findConflict(slipLegs, pick);
                if (!conflict) {
                  setPendingConflict(null);
                  append(toSlipLeg(pick, sport));
                  return;
                }
                // Exact duplicate: chip is already selected — quiet no-op.
                if (conflict.kind === "duplicate") {
                  setPendingConflict(null);
                  return;
                }
                setPendingConflict({ conflict, pick });
              }}
            />
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
    </div>
  );
}
