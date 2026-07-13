"use client";

import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { OddsAssist } from "@/components/scl/odds-assist";
import { SectionHeader } from "@/components/scl/section";
import { SportPills } from "@/components/scl/sport-pills";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createParlay } from "@/lib/actions/parlay.action";
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

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-neg text-xs">{message}</p>;
}

export default function NewParlayPage() {
  const router = useRouter();
  const [sport, setSport] = useState("");
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateParlayFormInput, unknown, CreateParlayInput>({
    resolver: zodResolver(createParlaySchema),
    defaultValues: { units: 1, legs: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "legs" });

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

  async function onSubmit(values: CreateParlayInput) {
    const res = await createParlay(values);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Parlay submitted");
    router.push("/dashboard/picks");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
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
          {...register("units")}
        />
        <p className="text-muted-foreground text-xs">
          The parlay carries the stake; legs are components.
        </p>
        <FieldError message={errors.units?.message} />
      </Card>

      <Card className="space-y-2 p-4 sm:p-5">
        <Label>Add legs from the board</Label>
        <SportPills value={sport} onChange={setSport} />
      </Card>

      {sport ? (
        <OddsAssist
          sport={sport}
          onPick={(pick) =>
            append({
              sport,
              market: pick.market,
              selection: pick.selection,
              oddsAmerican: pick.oddsAmerican,
              eventId: pick.eventId,
              eventStartsAt: pick.eventStartsAt,
              side: pick.side,
              line: pick.line,
              player: pick.player,
            })
          }
        />
      ) : null}

      <Card className="border-brand/50 scl-elevated space-y-3 border-2 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-[0.7rem] font-semibold tracking-wide uppercase">
            Parlay slip
          </p>
          <span className="text-muted-foreground text-xs">
            {fields.length} {fields.length === 1 ? "leg" : "legs"}
          </span>
        </div>

        {fields.length ? (
          <div className="divide-border divide-y">
            {fields.map((field, i) => {
              const leg = legs?.[i];
              const legOdds = Number(leg?.oddsAmerican);
              return (
                <div
                  key={field.id}
                  className="flex items-center justify-between gap-3 py-2.5"
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
                    onClick={() => remove(i)}
                    aria-label={`Remove leg ${i + 1}`}
                    className="text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded-md p-1.5"
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
    </div>
  );
}
