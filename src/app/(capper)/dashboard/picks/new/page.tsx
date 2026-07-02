"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { OddsAssist } from "@/components/scl/odds-assist";
import { SectionHeader } from "@/components/scl/section";
import { SPORTS, UNIT_MAX, UNIT_MIN, UNIT_STEP } from "@/lib/constants";
import {
  playSchema,
  type PlayFormInput,
  type PlayInput,
} from "@/lib/schemas/play.schema";
import { createPlay } from "@/lib/actions/play.action";

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
  const selectedSport = useWatch({ control, name: "sport" });

  async function onSubmit(values: PlayInput) {
    const res = await createPlay(values);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Play submitted");
    router.push("/dashboard/picks");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <SectionHeader
          title="Submit A Play"
          subtitle="Logged as pending until the result is graded"
        />
        <Button
          variant="ghost"
          render={<Link href="/dashboard/picks/new/parlay" />}
          nativeButton={false}
        >
          Parlay
        </Button>
      </div>
      {selectedSport ? (
        <OddsAssist
          sport={selectedSport}
          onPick={(pick) => {
            setValue("market", pick.market, { shouldValidate: true });
            setValue("selection", pick.selection, { shouldValidate: true });
            setValue("oddsAmerican", pick.oddsAmerican, {
              shouldValidate: true,
            });
            toast.success("Prefilled from live odds");
          }}
        />
      ) : null}
      {selectedSport ? (
        <div className="flex items-center gap-3">
          <span className="border-border flex-1 border-t" />
          <span className="text-muted-foreground text-xs">
            or enter manually
          </span>
          <span className="border-border flex-1 border-t" />
        </div>
      ) : null}
      <Card className="p-4 sm:p-6">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sport">Sport</Label>
              <select
                id="sport"
                className="border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-lg border bg-transparent px-3 text-base shadow-xs focus-visible:ring-[3px] focus-visible:outline-none sm:text-sm"
                defaultValue=""
                {...register("sport")}
              >
                <option value="" disabled>
                  Select…
                </option>
                {SPORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
              <FieldError message={errors.sport?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="league">League (Optional)</Label>
              <Input
                id="league"
                placeholder="e.g. NBA"
                {...register("league")}
              />
              <FieldError message={errors.league?.message} />
            </div>
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
            <FieldError message={errors.notes?.message} />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-h-11 w-full"
          >
            {isSubmitting ? "Submitting…" : "Submit Play"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-neg text-xs">{message}</p>;
}
