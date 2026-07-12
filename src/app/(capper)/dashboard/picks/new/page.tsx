"use client";

import { useState } from "react";
import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { OddsAssist } from "@/components/scl/odds-assist";
import { SectionHeader } from "@/components/scl/section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPlay } from "@/lib/actions/play.action";
import { SPORTS, UNIT_MAX, UNIT_MIN, UNIT_STEP } from "@/lib/constants";
import { formatOdds } from "@/lib/format";
import { americanToDecimal } from "@/lib/odds";
import {
  playSchema,
  type PlayFormInput,
  type PlayInput,
} from "@/lib/schemas/play.schema";

const SELECT_CLASS =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-lg border bg-transparent px-3 text-base shadow-xs focus-visible:ring-[3px] focus-visible:outline-none sm:text-sm";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-neg text-xs">{message}</p>;
}

export default function NewPlayPage() {
  const router = useRouter();
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
  const [manual, setManual] = useState(false);

  const sport = useWatch({ control, name: "sport" });
  const selection = useWatch({ control, name: "selection" });
  const market = useWatch({ control, name: "market" });
  const odds = useWatch({ control, name: "oddsAmerican" });
  const units = useWatch({ control, name: "units" });
  const eventId = useWatch({ control, name: "eventId" });
  const eventBound = Boolean(eventId);

  const oddsNum = Number(odds);
  const hasPick = Boolean(selection && market && Math.abs(oddsNum) >= 100);
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
    toast.success("Play added to your record");
    router.push("/dashboard/picks");
    router.refresh();
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
  }

  function clearPick() {
    setValue("selection", "");
    setValue("market", "");
    setValue("oddsAmerican", "" as unknown as number);
    clearEventBinding();
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <SectionHeader
          title="Submit A Play"
          subtitle="Tap a line off the board, set your units, submit"
        />
        <Button
          variant="ghost"
          render={<Link href="/dashboard/picks/new/parlay" />}
          nativeButton={false}
        >
          Parlay
        </Button>
      </div>

      {/* Sport — always visible; drives the board */}
      <Card className="space-y-1.5 p-4 sm:p-5">
        <Label htmlFor="sport">Sport</Label>
        <select
          id="sport"
          className={SELECT_CLASS}
          defaultValue=""
          {...register("sport")}
        >
          <option value="" disabled>
            Choose a sport to load tonight&apos;s board…
          </option>
          {SPORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <FieldError message={errors.sport?.message} />
      </Card>

      {manual ? (
        /* ---------- Manual entry (props / anything off-board) ---------- */
        <Card className="p-4 sm:p-6">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <div className="space-y-1.5">
              <Label htmlFor="league">League (Optional)</Label>
              <Input
                id="league"
                placeholder="e.g. NBA"
                {...register("league")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="market">Market</Label>
              <Input
                id="market"
                placeholder="e.g. Spread, Moneyline, Total, Player Prop"
                {...register("market")}
              />
              <FieldError message={errors.market?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="selection">Selection</Label>
              <Input
                id="selection"
                placeholder="e.g. Knicks -3.5"
                {...register("selection")}
              />
              <FieldError message={errors.selection?.message} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="oddsAmerican">Odds (American)</Label>
                <Input
                  id="oddsAmerican"
                  type="number"
                  step={1}
                  placeholder="-110"
                  {...register("oddsAmerican", { valueAsNumber: true })}
                />
                <FieldError message={errors.oddsAmerican?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="units">
                  Units ({UNIT_MIN}–{UNIT_MAX})
                </Label>
                <Input
                  id="units"
                  type="number"
                  step={UNIT_STEP}
                  min={UNIT_MIN}
                  max={UNIT_MAX}
                  {...register("units", { valueAsNumber: true })}
                />
                <FieldError message={errors.units?.message} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <textarea
                id="notes"
                rows={3}
                className="border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 min-h-24 w-full rounded-lg border bg-transparent px-3 py-2 text-base shadow-xs focus-visible:ring-[3px] focus-visible:outline-none sm:text-sm"
                placeholder="Reasoning (kept on your record)"
                {...register("notes")}
              />
            </div>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-h-11 w-full"
            >
              {isSubmitting ? "Submitting…" : "Submit Play"}
            </Button>
          </form>
          <button
            type="button"
            onClick={() => setManual(false)}
            className="text-muted-foreground hover:text-foreground mt-3 text-xs"
          >
            ← Back to the board
          </button>
        </Card>
      ) : (
        /* ---------- Board flow: pick a line → bet slip ---------- */
        <>
          {sport && !hasPick ? (
            <OddsAssist
              sport={sport}
              onPick={(pick) => {
                setValue("market", pick.market, { shouldValidate: true });
                setValue("selection", pick.selection, { shouldValidate: true });
                setValue("oddsAmerican", pick.oddsAmerican, {
                  shouldValidate: true,
                });
                // Carry the event binding so createPlay runs the strict path (C1 lock + C3 odds).
                setValue("eventId", pick.eventId);
                setValue("eventStartsAt", pick.eventStartsAt);
                setValue("side", pick.side);
                setValue("line", pick.line as number | undefined);
                setValue("player", pick.player ?? "");
              }}
            />
          ) : null}

          {hasPick ? (
            <Card className="border-brand/50 scl-elevated space-y-4 border-2 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-[0.7rem] font-semibold tracking-wide uppercase">
                    Bet slip
                  </p>
                  <p className="mt-0.5 text-lg font-bold break-words">
                    {selection}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {market} ·{" "}
                    <span className="text-foreground nums font-semibold tabular-nums">
                      {formatOdds(oddsNum)}
                    </span>
                  </p>
                  {eventBound ? (
                    <p className="text-brand mt-1 text-[0.7rem] font-medium">
                      Pre-game · odds will be verified
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={clearPick}
                  aria-label="Clear pick"
                  className="text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded-md p-1.5"
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
                  <p className="text-pos nums text-xl font-bold tabular-nums">
                    {toWin != null ? `+${toWin.toFixed(2)}u` : "—"}
                  </p>
                </div>
              </div>
              <FieldError message={errors.units?.message} />

              <Button
                type="button"
                onClick={handleSubmit(onSubmit)}
                disabled={isSubmitting}
                className="min-h-12 w-full text-base"
              >
                {isSubmitting ? "Submitting…" : "Submit Play"}
              </Button>
            </Card>
          ) : null}

          <button
            type="button"
            onClick={() => {
              clearEventBinding();
              setManual(true);
            }}
            className="text-muted-foreground hover:text-foreground mx-auto block text-xs"
          >
            Can&apos;t find it on the board? Enter a play manually
          </button>
        </>
      )}
    </div>
  );
}
