"use client";

import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { OddsAssist, type OddsPick } from "@/components/scl/odds-assist";
import { SectionHeader } from "@/components/scl/section";
import { SlipConflictPrompt } from "@/components/scl/slip-conflict-prompt";
import { StakeQuickChips } from "@/components/scl/stake-quick-chips";
import { Ticket } from "@/components/scl/ticket";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createParlay } from "@/lib/actions/parlay.action";
import { SPORTS, UNIT_MAX, UNIT_MIN, UNIT_STEP } from "@/lib/constants";
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
  const [slipOpen, setSlipOpen] = useState(false);
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
              className="min-h-12 w-full text-base"
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
    <Card className="border-brand/50 scl-elevated space-y-3 border-2 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-[0.7rem] font-semibold tracking-wide uppercase">
          Parlay slip
        </p>
        <span className="text-muted-foreground text-xs">
          {fields.length} {fields.length === 1 ? "leg" : "legs"}
        </span>
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
                  conflicting && "bg-brand/5 -mx-2 rounded-md px-2",
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
                        <span className="nums tabular-nums">
                          {formatOdds(legOdds)}
                        </span>
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
            <p className="nums text-lg font-bold tabular-nums">
              {formatOdds(combinedAmerican)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground text-xs">To win</p>
            <p className="text-pos nums text-lg font-bold tabular-nums">
              {toWin != null ? `+${toWin.toFixed(2)}u` : "—"}
            </p>
          </div>
        </div>
      ) : null}

      <FieldError message={errors.legs?.message} />

      <Button
        type="button"
        onClick={handleSubmit(onSubmit)}
        disabled={isSubmitting || fields.length < 2}
        className="min-h-12 w-full text-base"
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
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {SPORTS.map((s) => {
                const active = sport === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      setSport(s.key);
                      setPendingConflict(null);
                    }}
                    aria-pressed={active}
                    className={cn(
                      "scl-display flex h-11 shrink-0 items-center gap-2 rounded-[22px] border px-3.5 text-[15px] font-semibold tracking-[0.05em]",
                      active
                        ? "border-[color:var(--scl-gold)] bg-[color:var(--scl-gold)] text-[color:var(--scl-gold-ink)]"
                        : "border-[color:var(--scl-line)] bg-[color:var(--scl-ink-800)] text-[color:var(--scl-muted-data)]",
                    )}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
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
        <div className="lg:hidden">
          <div
            className="h-[calc(56px+env(safe-area-inset-bottom,0px)+1.5rem)]"
            aria-hidden
          />
          <div
            className="fixed inset-x-0 bottom-0 z-40 px-3"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <div
              className="mb-3 flex h-14 items-center gap-3 rounded-[14px] border px-4"
              style={{
                background: "linear-gradient(180deg,#1E2940,#141C2C)",
                borderColor: "var(--scl-gold-deep)",
                boxShadow: "var(--scl-shadow-slip)",
              }}
            >
              <span className="scl-display min-w-0 flex-1 truncate text-base font-bold tracking-[0.05em] uppercase">
                {fields.length} {fields.length === 1 ? "Leg" : "Legs"}
              </span>
              {combinedAmerican != null ? (
                <span className="scl-data shrink-0 text-[0.95rem] font-semibold text-[color:var(--scl-gold)]">
                  {formatOdds(combinedAmerican)}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => setSlipOpen(true)}
                className="scl-display h-10 shrink-0 rounded-[10px] bg-[color:var(--scl-gold)] px-4 text-sm font-bold tracking-[0.08em] text-[color:var(--scl-gold-ink)] uppercase"
                aria-haspopup="dialog"
                aria-expanded={slipOpen}
              >
                View Slip
              </button>
            </div>
          </div>
          <Sheet open={slipOpen} onOpenChange={setSlipOpen}>
            <SheetContent
              side="bottom"
              showCloseButton
              className="max-h-[85vh] gap-0 overflow-y-auto rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom,0px)]"
            >
              <SheetHeader className="border-border border-b px-4 py-3">
                <SheetTitle>Parlay slip</SheetTitle>
              </SheetHeader>
              <div className="p-4">{slipBody}</div>
            </SheetContent>
          </Sheet>
        </div>
      ) : null}
    </div>
  );
}
