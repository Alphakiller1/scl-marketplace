"use client";

import { useState } from "react";
import { CheckCircle2, ChevronLeft, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { OddsAssist, type OddsPick } from "@/components/scl/odds-assist";
import { SectionHeader } from "@/components/scl/section";
import { TeamMark } from "@/components/scl/team-mark";
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
  const [pickedTeam, setPickedTeam] = useState<string | undefined>();

  const sport = useWatch({ control, name: "sport" });
  const selection = useWatch({ control, name: "selection" });
  const market = useWatch({ control, name: "market" });
  const odds = useWatch({ control, name: "oddsAmerican" });
  const units = useWatch({ control, name: "units" });
  const sportField = register("sport");

  const oddsNum = Number(odds);
  const hasPick = Boolean(selection && market && Math.abs(oddsNum) >= 100);
  const selectedPick: OddsPick | null = hasPick
    ? {
        market: String(market),
        selection: String(selection),
        oddsAmerican: oddsNum,
        team: pickedTeam,
      }
    : null;
  const toWin =
    hasPick && typeof units === "number" && units > 0
      ? units * (americanToDecimal(oddsNum) - 1)
      : null;

  async function onSubmit(values: PlayInput) {
    const result = await createPlay(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Play added to your record");
    router.push("/dashboard/picks");
    router.refresh();
  }

  function clearPick() {
    setValue("selection", "");
    setValue("market", "");
    setValue("oddsAmerican", "" as unknown as number);
    setPickedTeam(undefined);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <SectionHeader
          title="Submit A Play"
          subtitle="Choose a line, confirm your stake, add it to your record"
        />
        <Button
          variant="ghost"
          render={<Link href="/dashboard/picks/new/parlay" />}
          nativeButton={false}
        >
          Parlay
        </Button>
      </div>

      <Card className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
        <Label htmlFor="sport" className="shrink-0">
          Choose sport
        </Label>
        <select
          id="sport"
          className={`${SELECT_CLASS} sm:max-w-xs`}
          defaultValue=""
          {...sportField}
          onChange={(event) => {
            void sportField.onChange(event);
            clearPick();
            setManual(false);
          }}
        >
          <option value="" disabled>
            Select a live board…
          </option>
          {SPORTS.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
        <FieldError message={errors.sport?.message} />
        <span className="text-muted-foreground text-xs sm:ml-auto">
          Live board prices or manual entry
        </span>
      </Card>

      {manual ? (
        <Card className="mx-auto max-w-xl p-4 sm:p-6">
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
                placeholder="Spread, moneyline, total, player prop"
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
                <Label htmlFor="oddsAmerican">American odds</Label>
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
                placeholder="Reasoning kept on your record"
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
            <ChevronLeft className="mr-1 inline size-3" aria-hidden />
            Back to the board
          </button>
        </Card>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0">
            {sport ? (
              <OddsAssist
                sport={sport}
                selected={selectedPick}
                onPick={(pick) => {
                  setValue("market", pick.market, { shouldValidate: true });
                  setValue("selection", pick.selection, {
                    shouldValidate: true,
                  });
                  setValue("oddsAmerican", pick.oddsAmerican, {
                    shouldValidate: true,
                  });
                  setPickedTeam(pick.team);
                }}
              />
            ) : null}
          </div>

          <div className="lg:sticky lg:top-20">
            {hasPick ? (
              <Card className="border-brand/50 scl-elevated gap-0 overflow-hidden border-2 p-0">
                <div className="border-border bg-brand/10 flex items-center gap-2 border-b px-4 py-2.5">
                  <CheckCircle2 className="text-brand size-4" aria-hidden />
                  <span className="text-sm font-semibold">Selection added</span>
                </div>
                <div className="space-y-4 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      {pickedTeam && sport ? (
                        <TeamMark
                          team={pickedTeam}
                          sport={sport}
                          className="size-10"
                        />
                      ) : null}
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
                      </div>
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
                </div>
              </Card>
            ) : sport ? (
              <Card className="border-dashed p-5 text-center lg:min-h-52 lg:place-content-center">
                <p className="font-semibold">Build your slip</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Select any price from the board. Your choice and stake stay
                  visible here while you compare the remaining lines.
                </p>
              </Card>
            ) : null}

            <button
              type="button"
              onClick={() => setManual(true)}
              className="text-muted-foreground hover:text-foreground mx-auto mt-3 block text-xs"
            >
              Can&apos;t find it? Enter a play manually
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
